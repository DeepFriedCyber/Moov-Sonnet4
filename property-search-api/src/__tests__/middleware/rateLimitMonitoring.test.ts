import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitMonitor } from '../../middleware/RateLimitMonitor';
import { createMockRedis, createMockEventEmitter } from '../helpers/mockRedis';

describe('Rate Limit Monitoring', () => {
  let monitor: RateLimitMonitor;
  let mockRedis: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockEventEmitter = createMockEventEmitter();
    monitor = new RateLimitMonitor(mockRedis, mockEventEmitter);
  });

  it('should track rate limit violations by IP', async () => {
    const violation = {
      ip: '192.168.1.1',
      endpoint: '/api/properties/search',
      timestamp: new Date(),
      requestsInWindow: 105,
      limit: 100
    };

    await monitor.recordViolation(violation);

    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'rate_limit_violations',
      expect.any(Number),
      expect.stringContaining('192.168.1.1')
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('rateLimitViolation', violation);
  });

  it('should detect suspicious patterns', async () => {
    // Mock multiple violations from same IP
    mockRedis.zrangebyscore.mockResolvedValue([
      JSON.stringify({ ip: '192.168.1.1', endpoint: '/api/test', timestamp: new Date() }),
      JSON.stringify({ ip: '192.168.1.1', endpoint: '/api/test', timestamp: new Date() }),
      JSON.stringify({ ip: '192.168.1.1', endpoint: '/api/test', timestamp: new Date() }),
      JSON.stringify({ ip: '192.168.1.1', endpoint: '/api/test', timestamp: new Date() }),
      JSON.stringify({ ip: '192.168.1.1', endpoint: '/api/test', timestamp: new Date() })
    ]);

    const suspiciousIPs = await monitor.detectSuspiciousActivity();

    expect(suspiciousIPs).toContain('192.168.1.1');
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('suspiciousActivity', expect.objectContaining({
      type: 'repeated_violations',
      ip: '192.168.1.1'
    }));
  });

  it('should generate rate limiting analytics', async () => {
    mockRedis.hget
      .mockResolvedValueOnce('1000') // total_requests
      .mockResolvedValueOnce('50')   // blocked_requests
      .mockResolvedValueOnce('200'); // unique_ips

    mockRedis.hgetall
      .mockResolvedValueOnce({
        '/api/properties/search': '500',
        '/api/properties/details': '300',
        '/api/auth/login': '200'
      })
      .mockResolvedValueOnce({
        '192.168.1.1': '10',
        '192.168.1.2': '5',
        '192.168.1.3': '3'
      });

    const analytics = await monitor.getAnalytics();

    expect(analytics).toMatchObject({
      totalRequests: 1000,
      blockedRequests: 50,
      uniqueIPs: 200,
      blockRate: 0.05,
      topEndpoints: expect.any(Array),
      topViolators: expect.any(Array)
    });
  });
});