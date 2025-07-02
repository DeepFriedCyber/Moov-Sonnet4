import React, { useState, useEffect } from 'react';
import {
  BarChart,
  LineChart,
  Users,
  Home,
  Search,
  Settings,
  Activity,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Eye,
  Heart,
  MessageSquare,
} from 'lucide-react';
import { useAdminContext } from '@/contexts/AdminContext';
import { MetricsCard } from './MetricsCard';
import { DataTable } from './DataTable';
import { ActivityFeed } from './ActivityFeed';
import { SystemHealth } from './SystemHealth';
import { AnalyticsChart } from './AnalyticsChart';

interface DashboardMetrics {
  totalProperties: number;
  activeUsers: number;
  searchVolume: number;
  revenue: number;
  propertyViews: number;
  favorites: number;
  contactRequests: number;
  trends: {
    properties: number;
    users: number;
    searches: number;
    revenue: number;
  };
}

export function AdminDashboard() {
  const { user, permissions } = useAdminContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30s
    
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md h-screen sticky top-0">
          <div className="p-4">
            <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
            <p className="text-sm text-gray-600">Welcome, {user.name}</p>
          </div>
          
          <nav className="mt-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center px-4 py-3 text-left
                  ${activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <tab.icon className="w-5 h-5 mr-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeTab === 'overview' && (
            <OverviewTab metrics={metrics} isLoading={isLoading} />
          )}
          {activeTab === 'properties' && <PropertiesTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ metrics, isLoading }: { metrics: DashboardMetrics | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return <div>Failed to load metrics</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">Dashboard Overview</h2>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricsCard
          title="Total Properties"
          value={metrics.totalProperties.toLocaleString()}
          trend={metrics.trends.properties}
          icon={Home}
          color="blue"
        />
        <MetricsCard
          title="Active Users"
          value={metrics.activeUsers.toLocaleString()}
          trend={metrics.trends.users}
          icon={Users}
          color="green"
        />
        <MetricsCard
          title="Search Volume"
          value={`${(metrics.searchVolume / 1000).toFixed(1)}k`}
          trend={metrics.trends.searches}
          icon={Search}
          color="purple"
        />
        <MetricsCard
          title="Revenue"
          value={`£${(metrics.revenue / 1000).toFixed(1)}k`}
          trend={metrics.trends.revenue}
          icon={DollarSign}
          color="yellow"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricsCard
          title="Property Views"
          value={metrics.propertyViews.toLocaleString()}
          icon={Eye}
          color="indigo"
        />
        <MetricsCard
          title="Favorites Added"
          value={metrics.favorites.toLocaleString()}
          icon={Heart}
          color="red"
        />
        <MetricsCard
          title="Contact Requests"
          value={metrics.contactRequests.toLocaleString()}
          icon={MessageSquare}
          color="orange"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Search Volume Trend</h3>
          <AnalyticsChart type="line" data={[]} />
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <ActivityFeed />
        </div>
      </div>

      {/* System Health */}
      <div className="mt-8">
        <SystemHealth />
      </div>
    </div>
  );
}

// Properties Tab
function PropertiesTab() {
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    type: 'all',
  });
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  const handleBulkAction = async (action: string) => {
    try {
      await fetch('/api/admin/properties/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          propertyIds: selectedProperties,
        }),
      });
      
      // Refresh properties list
      loadProperties();
      setSelectedProperties([]);
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  const loadProperties = async () => {
    // Implementation for loading properties
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Property Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Add Property
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search properties..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="border rounded-md px-3 py-2"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border rounded-md px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="border rounded-md px-3 py-2"
          >
            <option value="all">All Types</option>
            <option value="house">House</option>
            <option value="apartment">Apartment</option>
            <option value="studio">Studio</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedProperties.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-blue-800">
              {selectedProperties.length} properties selected
            </span>
            <div className="space-x-2">
              <button
                onClick={() => handleBulkAction('activate')}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkAction('deactivate')}
                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
              >
                Deactivate
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Properties Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          data={properties}
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'type', label: 'Type' },
            { key: 'price', label: 'Price' },
            { key: 'location', label: 'Location' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: 'Actions' },
          ]}
          onSelectionChange={setSelectedProperties}
        />
      </div>
    </div>
  );
}

// Users Tab
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({
    total: 0,
    activeToday: 0,
    newThisWeek: 0,
  });

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">User Management</h2>

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">Total Users</h3>
          <p className="text-3xl font-bold text-blue-600">{userStats.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">Active Today</h3>
          <p className="text-3xl font-bold text-green-600">{userStats.activeToday.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">New This Week</h3>
          <p className="text-3xl font-bold text-purple-600">{userStats.newThisWeek.toLocaleString()}</p>
        </div>
      </div>

      {/* User Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search users..."
            className="border rounded-md px-3 py-2"
          />
          <select className="border rounded-md px-3 py-2">
            <option value="all">All Users</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          data={users}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'joinDate', label: 'Join Date' },
            { key: 'lastActive', label: 'Last Active' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: 'Actions' },
          ]}
        />
      </div>
    </div>
  );
}

// Analytics Tab
function AnalyticsTab() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [dateRange, setDateRange] = useState('30d');

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <div className="flex space-x-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border rounded-md px-3 py-2"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Export Data
          </button>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Search Volume</h3>
          <div data-testid="search-volume-chart" className="h-64 bg-gray-100 rounded"></div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">User Engagement</h3>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
        <div className="space-y-4">
          <div data-testid="funnel-step" className="flex items-center justify-between p-4 bg-blue-50 rounded">
            <span className="font-medium">Search (100%)</span>
            <span className="text-blue-600">10,000 users</span>
          </div>
          <div data-testid="funnel-step" className="flex items-center justify-between p-4 bg-green-50 rounded">
            <span className="font-medium">View Property (45%)</span>
            <span className="text-green-600">4,500 users</span>
          </div>
          <div data-testid="funnel-step" className="flex items-center justify-between p-4 bg-yellow-50 rounded">
            <span className="font-medium">Contact Agent (12%)</span>
            <span className="text-yellow-600">1,200 users</span>
          </div>
          <div data-testid="funnel-step" className="flex items-center justify-between p-4 bg-purple-50 rounded">
            <span className="font-medium">Book Viewing (8%)</span>
            <span className="text-purple-600">800 users</span>
          </div>
        </div>
      </div>

      {/* Popular Searches */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Popular Searches</h3>
        <div data-testid="popular-searches-table" className="space-y-2">
          <div className="flex justify-between py-2 border-b">
            <span>London apartments</span>
            <span className="text-gray-600">2,345 searches</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Manchester houses</span>
            <span className="text-gray-600">1,876 searches</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Birmingham studios</span>
            <span className="text-gray-600">1,234 searches</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Tab
function SettingsTab() {
  const [featureFlags, setFeatureFlags] = useState({
    semanticSearch: true,
    realTimeUpdates: true,
    advancedFilters: false,
  });

  const handleFeatureFlagChange = async (flag: string, value: boolean) => {
    try {
      await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [flag]: value }),
      });
      
      setFeatureFlags(prev => ({ ...prev, [flag]: value }));
    } catch (error) {
      console.error('Failed to update feature flag:', error);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">System Settings</h2>

      {/* Feature Flags */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Feature Flags</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Semantic Search</h4>
              <p className="text-sm text-gray-600">Enable AI-powered semantic search</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={featureFlags.semanticSearch}
                onChange={(e) => handleFeatureFlagChange('semanticSearch', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Real-time Updates</h4>
              <p className="text-sm text-gray-600">Enable WebSocket real-time updates</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={featureFlags.realTimeUpdates}
                onChange={(e) => handleFeatureFlagChange('realTimeUpdates', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Email Templates</h3>
        <div className="space-y-2">
          <button className="w-full text-left p-3 border rounded hover:bg-gray-50">
            Welcome Email
          </button>
          <button className="w-full text-left p-3 border rounded hover:bg-gray-50">
            Password Reset
          </button>
          <button className="w-full text-left p-3 border rounded hover:bg-gray-50">
            Property Alert
          </button>
        </div>
      </div>
    </div>
  );
}