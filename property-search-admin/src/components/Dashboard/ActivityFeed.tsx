import React, { useState, useEffect } from 'react';
import { User, Search, Heart, Eye, MessageSquare, Home, Clock } from 'lucide-react';

interface Activity {
  id: string;
  type: 'user_registration' | 'property_search' | 'property_view' | 'favorite_added' | 'contact_request' | 'property_added';
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

const activityIcons = {
  user_registration: User,
  property_search: Search,
  property_view: Eye,
  favorite_added: Heart,
  contact_request: MessageSquare,
  property_added: Home,
};

const activityColors = {
  user_registration: 'text-green-600 bg-green-100',
  property_search: 'text-blue-600 bg-blue-100',
  property_view: 'text-purple-600 bg-purple-100',
  favorite_added: 'text-red-600 bg-red-100',
  contact_request: 'text-yellow-600 bg-yellow-100',
  property_added: 'text-indigo-600 bg-indigo-100',
};

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    
    // Set up real-time updates
    const interval = setInterval(loadActivities, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadActivities = async () => {
    try {
      const response = await fetch('/api/admin/activities');
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="activity-feed">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="activity-feed">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.type];
        const colorClass = activityColors[activity.type];

        return (
          <div 
            key={activity.id} 
            className="flex items-start space-x-3"
            data-testid="activity-item"
          >
            <div className={`p-2 rounded-full ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.user.name}</span>
                  {' '}
                  <span>{activity.description}</span>
                </p>
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTimeAgo(activity.timestamp)}
                </div>
              </div>
              
              {activity.metadata && (
                <div className="mt-1 text-xs text-gray-500">
                  {activity.type === 'property_search' && activity.metadata.query && (
                    <span>Query: "{activity.metadata.query}"</span>
                  )}
                  {activity.type === 'property_view' && activity.metadata.propertyTitle && (
                    <span>Property: {activity.metadata.propertyTitle}</span>
                  )}
                  {activity.type === 'contact_request' && activity.metadata.agentName && (
                    <span>Agent: {activity.metadata.agentName}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {activities.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <Clock className="w-8 h-8 mx-auto" />
          </div>
          <p className="text-gray-500">No recent activity</p>
        </div>
      )}
    </div>
  );
}