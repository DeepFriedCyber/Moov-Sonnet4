import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Activity, Database, Server, Wifi } from 'lucide-react';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime?: number;
  lastCheck: Date;
  message?: string;
}

interface SystemHealthData {
  overall: 'healthy' | 'warning' | 'error';
  services: HealthStatus[];
  uptime: number;
  version: string;
}

const statusIcons = {
  healthy: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
};

const statusColors = {
  healthy: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
};

const serviceIcons = {
  'API': Server,
  'Database': Database,
  'Search Service': Activity,
  'WebSocket': Wifi,
};

export function SystemHealth() {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHealthData();
    
    // Refresh health data every 30 seconds
    const interval = setInterval(loadHealthData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadHealthData = async () => {
    try {
      const response = await fetch('/api/admin/health');
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      console.error('Failed to load health data:', error);
      // Set error state
      setHealthData({
        overall: 'error',
        services: [
          {
            service: 'API',
            status: 'error',
            lastCheck: new Date(),
            message: 'Failed to connect',
          },
        ],
        uptime: 0,
        version: 'Unknown',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Health</h3>
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
              <div className="flex-1 h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Health</h3>
        <div className="text-center py-8">
          <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-gray-500">Failed to load health data</p>
        </div>
      </div>
    );
  }

  const OverallIcon = statusIcons[healthData.overall];
  const overallColor = statusColors[healthData.overall];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">System Health</h3>
        <div className="flex items-center space-x-2">
          <OverallIcon className={`w-5 h-5 ${overallColor}`} />
          <span className={`font-medium ${overallColor}`}>
            {healthData.overall.charAt(0).toUpperCase() + healthData.overall.slice(1)}
          </span>
        </div>
      </div>

      {/* System Info */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-600">Uptime</p>
          <p className="font-medium">{formatUptime(healthData.uptime)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Version</p>
          <p className="font-medium">{healthData.version}</p>
        </div>
      </div>

      {/* Service Status */}
      <div className="space-y-3">
        {healthData.services.map((service) => {
          const StatusIcon = statusIcons[service.status];
          const statusColor = statusColors[service.status];
          const ServiceIcon = serviceIcons[service.service as keyof typeof serviceIcons] || Server;

          return (
            <div key={service.service} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <ServiceIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium">{service.service}</p>
                  {service.message && (
                    <p className="text-sm text-gray-500">{service.message}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {service.responseTime && (
                  <span className="text-sm text-gray-500">
                    {service.responseTime}ms
                  </span>
                )}
                <div className="flex items-center space-x-1">
                  <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                  <span className={`text-sm font-medium ${statusColor}`}>
                    {service.status === 'healthy' ? 'Healthy' : 
                     service.status === 'warning' ? 'Warning' : 'Error'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last Updated */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}