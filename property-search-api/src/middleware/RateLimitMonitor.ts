import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface RateLimitViolation {
  ip: string;
  endpoint: string;
  timestamp: Date;
  requestsInWindow: number;
  limit: number;
  userAgent?: string;
  userId?: string;
}

export interface RateLimitAnalytics {
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  blockRate: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
  topViolators: Array<{ ip: string; violations: number }>;
}

export class RateLimitMonitor {
  private redis: Redis;
  private eventEmitter: EventEmitter;

  constructor(redis: Redis, eventEmitter: EventEmitter) {
    this.redis = redis;
    this.eventEmitter = eventEmitter;
  }

  async recordViolation(violation: RateLimitViolation): Promise<void> {
    const key = 'rate_limit_violations';
    const score = violation.timestamp.getTime();
    const member = JSON.stringify({
      ip: violation.ip,
      endpoint: violation.endpoint,
      timestamp: violation.timestamp,
      requests: violation.requestsInWindow,
      limit: violation.limit
    });

    // Store violation with timestamp as score for time-based queries
    await this.redis.zadd(key, score, member);
    
    // Clean up old violations (older than 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore(key, 0, oneDayAgo);

    // Track violation count per IP
    await this.redis.hincrby('violation_count_by_ip', violation.ip, 1);
    
    // Emit event for real-time monitoring
    this.eventEmitter.emit('rateLimitViolation', violation);
  }

  async detectSuspiciousActivity(): Promise<string[]> {
    const suspiciousIPs: string[] = [];
    
    // Get IPs with more than 5 violations in the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentViolations = await this.redis.zrangebyscore(
      'rate_limit_violations',
      oneHourAgo,
      Date.now()
    );

    const ipViolationCount: Record<string, number> = {};
    
    for (const violation of recentViolations) {
      try {
        const parsed = JSON.parse(violation);
        ipViolationCount[parsed.ip] = (ipViolationCount[parsed.ip] || 0) + 1;
      } catch (error) {
        console.error('Failed to parse violation:', error);
      }
    }

    // Flag IPs with excessive violations
    for (const [ip, count] of Object.entries(ipViolationCount)) {
      if (count >= 5) {
        suspiciousIPs.push(ip);
        this.eventEmitter.emit('suspiciousActivity', {
          type: 'repeated_violations',
          ip,
          violationCount: count,
          timeWindow: '1 hour'
        });
      }
    }

    return suspiciousIPs;
  }

  async getAnalytics(): Promise<RateLimitAnalytics> {
    const [
      totalRequests,
      blockedRequests,
      uniqueIPs,
      topEndpoints,
      topViolators
    ] = await Promise.all([
      this.redis.hget('rate_limit_stats', 'total_requests'),
      this.redis.hget('rate_limit_stats', 'blocked_requests'),
      this.redis.hget('rate_limit_stats', 'unique_ips'),
      this.getTopEndpoints(),
      this.getTopViolators()
    ]);

    const total = parseInt(totalRequests || '0');
    const blocked = parseInt(blockedRequests || '0');

    return {
      totalRequests: total,
      blockedRequests: blocked,
      uniqueIPs: parseInt(uniqueIPs || '0'),
      blockRate: total > 0 ? blocked / total : 0,
      topEndpoints,
      topViolators
    };
  }

  private async getTopEndpoints(): Promise<Array<{ endpoint: string; requests: number }>> {
    const endpoints = await this.redis.hgetall('endpoint_request_count');
    
    return Object.entries(endpoints)
      .map(([endpoint, requests]) => ({ endpoint, requests: parseInt(requests) }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }

  private async getTopViolators(): Promise<Array<{ ip: string; violations: number }>> {
    const violators = await this.redis.hgetall('violation_count_by_ip');
    
    return Object.entries(violators)
      .map(([ip, violations]) => ({ ip, violations: parseInt(violations) }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);
  }
}