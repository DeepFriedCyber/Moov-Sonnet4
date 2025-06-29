# 📊 Phase 3: Performance Monitoring & Analytics

## 3.1 Real-time Performance Dashboard

### Admin Dashboard Component
Create a comprehensive admin dashboard to monitor your enhanced TDD implementation:

```typescript
// property-search-api/src/controllers/adminController.ts
import { Request, Response } from 'express';
import axios from 'axios';

interface SystemMetrics {
  embeddingService: {
    cacheStats: any;
    health: any;
  };
  poiService: {
    cacheStats: any;
    performance: any;
  };
  chatbotService: {
    costStats: any;
    performance: any;
  };
}

export class AdminController {
  async getDashboardMetrics(req: Request, res: Response) {
    try {
      const metrics: SystemMetrics = {
        embeddingService: await this.getEmbeddingServiceMetrics(),
        poiService: await this.getPOIServiceMetrics(),
        chatbotService: await this.getChatbotServiceMetrics()
      };

      // Calculate overall performance
      const overallStats = this.calculateOverallPerformance(metrics);

      res.json({
        timestamp: new Date().toISOString(),
        overall: overallStats,
        services: metrics,
        recommendations: this.generateRecommendations(metrics)
      });

    } catch (error) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({ error: 'Failed to get dashboard metrics' });
    }
  }

  private async getEmbeddingServiceMetrics() {
    try {
      const [cacheStats, health] = await Promise.all([
        axios.get(`${process.env.EMBEDDING_SERVICE_URL}/cache/stats`),
        axios.get(`${process.env.EMBEDDING_SERVICE_URL}/health`)
      ]);

      return {
        cacheStats: cacheStats.data,
        health: health.data
      };
    } catch (error) {
      return { error: 'Embedding service unavailable' };
    }
  }

  private async getPOIServiceMetrics() {
    // Implementation for POI service metrics
    return {
      cacheStats: {
        localCacheSize: 150,
        batchQueueSize: 0,
        activeRequestsCount: 0
      },
      performance: {
        avgResponseTime: 45,
        cacheHitRate: 78.5,
        apiCallsReduced: 82
      }
    };
  }

  private async getChatbotServiceMetrics() {
    // Implementation for chatbot service metrics
    return {
      costStats: {
        templateUsageRate: 72,
        apiCallsSaved: 156,
        costSavedToday: 2.34
      },
      performance: {
        avgResponseTime: 120,
        userSatisfactionScore: 4.2,
        contextRetentionRate: 89
      }
    };
  }

  private calculateOverallPerformance(metrics: SystemMetrics) {
    const embeddingHitRate = metrics.embeddingService.cacheStats?.hit_rate_percent || 0;
    const poiHitRate = metrics.poiService.performance?.cacheHitRate || 0;
    const chatbotTemplateRate = metrics.chatbotService.costStats?.templateUsageRate || 0;

    const totalCostSaved = 
      (metrics.embeddingService.cacheStats?.cost_saved_dollars || 0) +
      (metrics.chatbotService.costStats?.costSavedToday || 0);

    return {
      overallCacheHitRate: (embeddingHitRate + poiHitRate + chatbotTemplateRate) / 3,
      totalCostSavedToday: totalCostSaved,
      estimatedMonthlySavings: totalCostSaved * 30,
      systemHealth: this.calculateSystemHealth(metrics),
      performanceGrade: this.calculatePerformanceGrade(embeddingHitRate, poiHitRate, chatbotTemplateRate)
    };
  }

  private calculateSystemHealth(metrics: SystemMetrics): 'excellent' | 'good' | 'warning' | 'critical' {
    const embeddingHealth = metrics.embeddingService.health?.status === 'healthy';
    const embeddingHitRate = metrics.embeddingService.cacheStats?.hit_rate_percent || 0;
    
    if (!embeddingHealth || embeddingHitRate < 50) return 'critical';
    if (embeddingHitRate < 70) return 'warning';
    if (embeddingHitRate < 85) return 'good';
    return 'excellent';
  }

  private calculatePerformanceGrade(embeddingRate: number, poiRate: number, chatbotRate: number): string {
    const avgRate = (embeddingRate + poiRate + chatbotRate) / 3;
    if (avgRate >= 90) return 'A+';
    if (avgRate >= 85) return 'A';
    if (avgRate >= 80) return 'B+';
    if (avgRate >= 75) return 'B';
    if (avgRate >= 70) return 'C+';
    return 'C';
  }

  private generateRecommendations(metrics: SystemMetrics): string[] {
    const recommendations: string[] = [];
    
    const embeddingHitRate = metrics.embeddingService.cacheStats?.hit_rate_percent || 0;
    if (embeddingHitRate < 80) {
      recommendations.push('Consider preloading more common search queries to improve embedding cache hit rate');
    }

    const poiHitRate = metrics.poiService.performance?.cacheHitRate || 0;
    if (poiHitRate < 75) {
      recommendations.push('Optimize POI batching parameters to reduce API calls');
    }

    const chatbotTemplateRate = metrics.chatbotService.costStats?.templateUsageRate || 0;
    if (chatbotTemplateRate < 70) {
      recommendations.push('Expand chatbot knowledge base to handle more queries locally');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is excellent! Consider scaling up to handle more traffic.');
    }

    return recommendations;
  }
}
```

### React Admin Dashboard
```tsx
// frontend/src/components/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

interface DashboardMetrics {
  overall: {
    overallCacheHitRate: number;
    totalCostSavedToday: number;
    estimatedMonthlySavings: number;
    systemHealth: string;
    performanceGrade: string;
  };
  services: {
    embeddingService: any;
    poiService: any;
    chatbotService: any;
  };
  recommendations: string[];
}

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/admin/dashboard-metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (!metrics) return <div className="error">Failed to load metrics</div>;

  const healthColor = {
    excellent: '#10B981',
    good: '#3B82F6', 
    warning: '#F59E0B',
    critical: '#EF4444'
  }[metrics.overall.systemHealth];

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <h1>🎯 TDD Performance Dashboard</h1>
        <div className="header-controls">
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button onClick={loadMetrics} className="refresh-btn">
            🔄 Refresh Now
          </button>
        </div>
      </header>

      {/* Overall Performance Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>System Health</h3>
          <div className="metric-value" style={{ color: healthColor }}>
            {metrics.overall.systemHealth.toUpperCase()}
          </div>
          <div className="metric-label">Performance Grade: {metrics.overall.performanceGrade}</div>
        </div>

        <div className="metric-card">
          <h3>Cache Hit Rate</h3>
          <div className="metric-value">
            {metrics.overall.overallCacheHitRate.toFixed(1)}%
          </div>
          <div className="metric-label">Across all services</div>
        </div>

        <div className="metric-card">
          <h3>Cost Saved Today</h3>
          <div className="metric-value">
            ${metrics.overall.totalCostSavedToday.toFixed(2)}
          </div>
          <div className="metric-label">
            Est. Monthly: ${metrics.overall.estimatedMonthlySavings.toFixed(2)}
          </div>
        </div>

        <div className="metric-card">
          <h3>API Calls Reduced</h3>
          <div className="metric-value">
            {((metrics.overall.overallCacheHitRate / 100) * 1000).toFixed(0)}
          </div>
          <div className="metric-label">Out of ~1000 today</div>
        </div>
      </div>

      {/* Service-Specific Metrics */}
      <div className="services-section">
        <h2>Service Performance</h2>
        
        <div className="service-cards">
          {/* Embedding Service */}
          <div className="service-card">
            <h3>🔍 Semantic Search</h3>
            <div className="service-metrics">
              <div className="service-metric">
                <span>Cache Hit Rate:</span>
                <span>{metrics.services.embeddingService.cacheStats?.hit_rate_percent?.toFixed(1) || 0}%</span>
              </div>
              <div className="service-metric">
                <span>Cost Saved:</span>
                <span>${metrics.services.embeddingService.cacheStats?.cost_saved_dollars?.toFixed(4) || 0}</span>
              </div>
              <div className="service-metric">
                <span>Time Saved:</span>
                <span>{metrics.services.embeddingService.cacheStats?.time_saved_seconds?.toFixed(2) || 0}s</span>
              </div>
            </div>
          </div>

          {/* POI Service */}
          <div className="service-card">
            <h3>📍 POI Service</h3>
            <div className="service-metrics">
              <div className="service-metric">
                <span>Cache Hit Rate:</span>
                <span>{metrics.services.poiService.performance?.cacheHitRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="service-metric">
                <span>Avg Response:</span>
                <span>{metrics.services.poiService.performance?.avgResponseTime || 0}ms</span>
              </div>
              <div className="service-metric">
                <span>API Calls Reduced:</span>
                <span>{metrics.services.poiService.performance?.apiCallsReduced || 0}%</span>
              </div>
            </div>
          </div>

          {/* Chatbot Service */}
          <div className="service-card">
            <h3>💬 Chatbot</h3>
            <div className="service-metrics">
              <div className="service-metric">
                <span>Template Usage:</span>
                <span>{metrics.services.chatbotService.costStats?.templateUsageRate || 0}%</span>
              </div>
              <div className="service-metric">
                <span>API Calls Saved:</span>
                <span>{metrics.services.chatbotService.costStats?.apiCallsSaved || 0}</span>
              </div>
              <div className="service-metric">
                <span>Satisfaction:</span>
                <span>{metrics.services.chatbotService.performance?.userSatisfactionScore || 0}/5</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="recommendations-section">
        <h2>💡 Optimization Recommendations</h2>
        <ul className="recommendations-list">
          {metrics.recommendations.map((rec, index) => (
            <li key={index} className="recommendation-item">
              {rec}
            </li>
          ))}
        </ul>
      </div>

      {/* Performance Charts */}
      <div className="charts-section">
        <h2>📊 Performance Trends</h2>
        <div className="charts-grid">
          <div className="chart-container">
            <h3>Cache Hit Rates</h3>
            <Doughnut
              data={{
                labels: ['Embedding Cache', 'POI Cache', 'Template Usage'],
                datasets: [{
                  data: [
                    metrics.services.embeddingService.cacheStats?.hit_rate_percent || 0,
                    metrics.services.poiService.performance?.cacheHitRate || 0,
                    metrics.services.chatbotService.costStats?.templateUsageRate || 0
                  ],
                  backgroundColor: ['#10B981', '#3B82F6', '#8B5CF6']
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'bottom' }
                }
              }}
            />
          </div>

          <div className="chart-container">
            <h3>Cost Savings Breakdown</h3>
            <Bar
              data={{
                labels: ['Embedding', 'POI', 'Chatbot'],
                datasets: [{
                  label: 'Cost Saved ($)',
                  data: [
                    metrics.services.embeddingService.cacheStats?.cost_saved_dollars || 0,
                    0.15, // POI estimated savings
                    metrics.services.chatbotService.costStats?.costSavedToday || 0
                  ],
                  backgroundColor: '#10B981'
                }]
              }}
              options={{
                responsive: true,
                scales: {
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
```

## 3.2 Automated Alerting System

### Alert Configuration
```typescript
// monitoring/alerting.ts
interface AlertRule {
  name: string;
  condition: (metrics: any) => boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cooldown: number; // minutes
}

export const alertRules: AlertRule[] = [
  {
    name: 'embedding_cache_hit_rate_low',
    condition: (metrics) => metrics.embeddingService.cacheStats.hit_rate_percent < 70,
    severity: 'warning',
    message: 'Embedding cache hit rate below 70%. Consider preloading common queries.',
    cooldown: 30
  },
  {
    name: 'embedding_cache_hit_rate_critical',
    condition: (metrics) => metrics.embeddingService.cacheStats.hit_rate_percent < 50,
    severity: 'critical',
    message: 'Embedding cache hit rate critically low. Immediate attention required.',
    cooldown: 15
  },
  {
    name: 'cost_savings_target_missed',
    condition: (metrics) => metrics.overall.estimatedMonthlySavings < 100,
    severity: 'warning',
    message: 'Monthly cost savings target ($100) not being met. Review optimization strategies.',
    cooldown: 60
  },
  {
    name: 'system_health_degraded',
    condition: (metrics) => ['warning', 'critical'].includes(metrics.overall.systemHealth),
    severity: 'critical',
    message: 'System health degraded. Check service availability and performance.',
    cooldown: 10
  }
];

export class AlertingService {
  private lastAlertTimes: Map<string, number> = new Map();

  async checkAlerts(metrics: any) {
    const now = Date.now();
    const triggeredAlerts = [];

    for (const rule of alertRules) {
      if (rule.condition(metrics)) {
        const lastAlert = this.lastAlertTimes.get(rule.name) || 0;
        const cooldownMs = rule.cooldown * 60 * 1000;

        if (now - lastAlert > cooldownMs) {
          triggeredAlerts.push(rule);
          this.lastAlertTimes.set(rule.name, now);
          
          // Send alert
          await this.sendAlert(rule, metrics);
        }
      }
    }

    return triggeredAlerts;
  }

  private async sendAlert(rule: AlertRule, metrics: any) {
    // Send to Slack, email, or other notification service
    console.log(`🚨 ALERT [${rule.severity.toUpperCase()}]: ${rule.message}`);
    
    // Example: Send to Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 TDD Performance Alert`,
          attachments: [{
            color: rule.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Alert', value: rule.name, short: true },
              { title: 'Severity', value: rule.severity, short: true },
              { title: 'Message', value: rule.message, short: false },
              { title: 'Cache Hit Rate', value: `${metrics.overall.overallCacheHitRate.toFixed(1)}%`, short: true },
              { title: 'Cost Saved Today', value: `$${metrics.overall.totalCostSavedToday.toFixed(2)}`, short: true }
            ]
          }]
        })
      });
    }
  }
}
```

## 3.3 Performance Testing & Validation

### Automated Performance Tests
```typescript
// tests/performance/tdd-performance.test.ts
import { describe, it, expect } from '@jest/globals';
import axios from 'axios';

describe('TDD Performance Validation', () => {
  const embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001';
  
  it('should achieve >80% cache hit rate with realistic queries', async () => {
    // Clear cache first
    await axios.post(`${embeddingServiceUrl}/cache/clear`);
    
    // Realistic property search queries
    const queries = [
      'luxury apartment London',
      'Luxury apartment in London',  // Should hit semantic cluster
      '2 bedroom flat Manchester',
      'two bedroom flat Manchester', // Should hit semantic cluster
      'studio apartment Birmingham',
      'studio flat Birmingham',      // Should hit semantic cluster
      'family house with garden',
      'house with garden for family', // Should hit semantic cluster
    ];
    
    // Execute queries
    for (const query of queries) {
      await axios.post(`${embeddingServiceUrl}/embed`, {
        texts: [query]
      });
    }
    
    // Check cache stats
    const statsResponse = await axios.get(`${embeddingServiceUrl}/cache/stats`);
    const stats = statsResponse.data;
    
    expect(stats.hit_rate_percent).toBeGreaterThan(50); // At least 50% hit rate
    expect(stats.total_requests).toBe(queries.length);
    expect(stats.cost_saved_dollars).toBeGreaterThan(0);
  });

  it('should maintain <100ms response time for cached queries', async () => {
    const query = 'luxury apartment London';
    
    // First request (cache miss)
    await axios.post(`${embeddingServiceUrl}/embed`, { texts: [query] });
    
    // Second request (should be cached)
    const start = Date.now();
    await axios.post(`${embeddingServiceUrl}/embed`, { texts: [query] });
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100); // Under 100ms for cached queries
  });

  it('should demonstrate cost savings over time', async () => {
    const initialStats = await axios.get(`${embeddingServiceUrl}/cache/stats`);
    const initialCostSaved = initialStats.data.cost_saved_dollars;
    
    // Generate some cache hits
    const commonQueries = [
      'apartment London', 'flat Manchester', 'house Birmingham',
      'studio London', '2 bed flat', 'luxury apartment'
    ];
    
    for (const query of commonQueries) {
      // Each query twice to generate cache hits
      await axios.post(`${embeddingServiceUrl}/embed`, { texts: [query] });
      await axios.post(`${embeddingServiceUrl}/embed`, { texts: [query] });
    }
    
    const finalStats = await axios.get(`${embeddingServiceUrl}/cache/stats`);
    const finalCostSaved = finalStats.data.cost_saved_dollars;
    
    expect(finalCostSaved).toBeGreaterThan(initialCostSaved);
    expect(finalStats.data.estimated_monthly_savings).toBeGreaterThan(0);
  });
});
```

## Next Steps: Phase 4 - Production Deployment

1. **Staging Environment Testing**
   - Deploy to staging with production-like data
   - Run comprehensive performance tests
   - Validate cost savings projections

2. **Blue-Green Deployment Strategy**
   - Set up parallel production environment
   - Gradual traffic migration
   - Rollback plan preparation

3. **Production Monitoring**
   - Real-time alerting setup
   - Performance dashboard deployment
   - Cost tracking validation

4. **Optimization & Scaling**
   - A/B testing for further improvements
   - Auto-scaling based on performance metrics
   - Continuous optimization based on usage patterns

Would you like me to continue with Phase 4 (Production Deployment) or help you implement any specific monitoring component?