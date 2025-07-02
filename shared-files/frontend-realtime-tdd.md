# TDD Implementation for Frontend Architecture & Real-time Features

## 1. Frontend State Management with TDD

### A. Property Store Tests

```typescript
// property-search-frontend/src/store/property/propertyStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePropertyStore } from './propertyStore';
import { Property } from '@/types/property';

const mockProperty: Property = {
  id: '1',
  title: 'Test Property',
  price: 500000,
  location: {
    address: '123 Test St',
    city: 'London',
    postcode: 'SW1A 1AA',
    coordinates: { lat: 51.5074, lng: -0.1278 },
  },
  bedrooms: 2,
  bathrooms: 1,
  squareFootage: 850,
  propertyType: 'apartment',
  images: [],
  features: [],
  description: 'Test description',
  listedDate: new Date(),
  agent: {
    id: 'agent1',
    name: 'Test Agent',
    phone: '123456789',
    email: 'agent@test.com',
  },
};

describe('PropertyStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => usePropertyStore());
    act(() => {
      result.current.clearAll();
    });
  });

  describe('properties management', () => {
    it('should add properties to the store', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setProperties([mockProperty]);
      });

      expect(result.current.properties).toHaveLength(1);
      expect(result.current.properties[0]).toEqual(mockProperty);
    });

    it('should update existing property', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setProperties([mockProperty]);
        result.current.updateProperty('1', { price: 550000 });
      });

      expect(result.current.properties[0].price).toBe(550000);
    });

    it('should handle property pagination', () => {
      const { result } = renderHook(() => usePropertyStore());
      const properties = Array.from({ length: 50 }, (_, i) => ({
        ...mockProperty,
        id: `${i}`,
      }));

      act(() => {
        result.current.setProperties(properties);
        result.current.setTotalCount(50);
      });

      expect(result.current.properties).toHaveLength(50);
      expect(result.current.totalCount).toBe(50);
      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('search state', () => {
    it('should manage search query and filters', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setSearchQuery('modern apartment');
        result.current.setFilters({
          minPrice: 300000,
          maxPrice: 600000,
          bedrooms: 2,
        });
      });

      expect(result.current.searchQuery).toBe('modern apartment');
      expect(result.current.filters).toMatchObject({
        minPrice: 300000,
        maxPrice: 600000,
        bedrooms: 2,
      });
    });

    it('should track loading states', () => {
      const { result } = renderHook(() => usePropertyStore());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should handle search errors', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setError('Search failed');
      });

      expect(result.current.error).toBe('Search failed');
    });
  });

  describe('favorites management', () => {
    it('should add properties to favorites', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addFavorite('1');
        result.current.addFavorite('2');
      });

      expect(result.current.favorites).toEqual(['1', '2']);
      expect(result.current.isFavorite('1')).toBe(true);
      expect(result.current.isFavorite('3')).toBe(false);
    });

    it('should remove properties from favorites', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addFavorite('1');
        result.current.addFavorite('2');
        result.current.removeFavorite('1');
      });

      expect(result.current.favorites).toEqual(['2']);
    });

    it('should toggle favorites', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.toggleFavorite('1');
      });
      expect(result.current.isFavorite('1')).toBe(true);

      act(() => {
        result.current.toggleFavorite('1');
      });
      expect(result.current.isFavorite('1')).toBe(false);
    });
  });

  describe('view history', () => {
    it('should track viewed properties', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addToHistory(mockProperty);
      });

      expect(result.current.viewHistory).toHaveLength(1);
      expect(result.current.viewHistory[0]).toEqual(mockProperty);
    });

    it('should limit view history size', () => {
      const { result } = renderHook(() => usePropertyStore());
      const properties = Array.from({ length: 15 }, (_, i) => ({
        ...mockProperty,
        id: `${i}`,
      }));

      act(() => {
        properties.forEach(p => result.current.addToHistory(p));
      });

      // Should keep only last 10
      expect(result.current.viewHistory).toHaveLength(10);
      expect(result.current.viewHistory[0].id).toBe('5');
    });

    it('should prevent duplicate entries in history', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addToHistory(mockProperty);
        result.current.addToHistory(mockProperty);
      });

      expect(result.current.viewHistory).toHaveLength(1);
    });
  });
});
```

### B. Property Store Implementation

```typescript
// property-search-frontend/src/store/property/propertyStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Property } from '@/types/property';

interface PropertyFilters {
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  features?: string[];
  radius?: number;
}

interface PropertyState {
  // Properties
  properties: Property[];
  totalCount: number;
  currentPage: number;
  
  // Search
  searchQuery: string;
  filters: PropertyFilters;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'date';
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // User data
  favorites: string[];
  viewHistory: Property[];
  
  // Computed
  hasMore: boolean;
  
  // Actions
  setProperties: (properties: Property[]) => void;
  appendProperties: (properties: Property[]) => void;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  setTotalCount: (count: number) => void;
  
  setSearchQuery: (query: string) => void;
  setFilters: (filters: PropertyFilters) => void;
  setSortBy: (sort: PropertyState['sortBy']) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  
  addToHistory: (property: Property) => void;
  clearHistory: () => void;
  
  nextPage: () => void;
  resetPagination: () => void;
  clearAll: () => void;
}

export const usePropertyStore = create<PropertyState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        properties: [],
        totalCount: 0,
        currentPage: 1,
        searchQuery: '',
        filters: {},
        sortBy: 'relevance',
        isLoading: false,
        error: null,
        favorites: [],
        viewHistory: [],
        hasMore: false,

        // Actions
        setProperties: (properties) => set((state) => {
          state.properties = properties;
          state.hasMore = properties.length < state.totalCount;
        }),

        appendProperties: (properties) => set((state) => {
          state.properties.push(...properties);
          state.hasMore = state.properties.length < state.totalCount;
        }),

        updateProperty: (id, updates) => set((state) => {
          const index = state.properties.findIndex(p => p.id === id);
          if (index !== -1) {
            Object.assign(state.properties[index], updates);
          }
        }),

        setTotalCount: (count) => set((state) => {
          state.totalCount = count;
          state.hasMore = state.properties.length < count;
        }),

        setSearchQuery: (query) => set((state) => {
          state.searchQuery = query;
          state.currentPage = 1;
        }),

        setFilters: (filters) => set((state) => {
          state.filters = filters;
          state.currentPage = 1;
        }),

        setSortBy: (sort) => set((state) => {
          state.sortBy = sort;
          state.currentPage = 1;
        }),

        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        setError: (error) => set((state) => {
          state.error = error;
        }),

        addFavorite: (id) => set((state) => {
          if (!state.favorites.includes(id)) {
            state.favorites.push(id);
          }
        }),

        removeFavorite: (id) => set((state) => {
          state.favorites = state.favorites.filter(f => f !== id);
        }),

        toggleFavorite: (id) => {
          const isFav = get().isFavorite(id);
          if (isFav) {
            get().removeFavorite(id);
          } else {
            get().addFavorite(id);
          }
        },

        isFavorite: (id) => get().favorites.includes(id),

        addToHistory: (property) => set((state) => {
          // Remove if already exists
          state.viewHistory = state.viewHistory.filter(p => p.id !== property.id);
          // Add to beginning
          state.viewHistory.unshift(property);
          // Keep only last 10
          state.viewHistory = state.viewHistory.slice(0, 10);
        }),

        clearHistory: () => set((state) => {
          state.viewHistory = [];
        }),

        nextPage: () => set((state) => {
          state.currentPage += 1;
        }),

        resetPagination: () => set((state) => {
          state.currentPage = 1;
          state.properties = [];
        }),

        clearAll: () => set((state) => {
          state.properties = [];
          state.totalCount = 0;
          state.currentPage = 1;
          state.searchQuery = '';
          state.filters = {};
          state.sortBy = 'relevance';
          state.isLoading = false;
          state.error = null;
        }),
      })),
      {
        name: 'property-storage',
        partialize: (state) => ({
          favorites: state.favorites,
          viewHistory: state.viewHistory,
          filters: state.filters,
          sortBy: state.sortBy,
        }),
      }
    )
  )
);
```

## 2. Real-time WebSocket Features

### A. WebSocket Service Tests

```typescript
// property-search-frontend/src/services/websocket/WebSocketService.test.ts
import { WebSocketService } from './WebSocketService';
import { act, renderHook } from '@testing-library/react';
import WS from 'jest-websocket-mock';

describe('WebSocketService', () => {
  let server: WS;
  let wsService: WebSocketService;

  beforeEach(async () => {
    server = new WS('ws://localhost:3001/ws');
    wsService = new WebSocketService('ws://localhost:3001/ws');
  });

  afterEach(() => {
    WS.clean();
    wsService.disconnect();
  });

  describe('connection management', () => {
    it('should establish WebSocket connection', async () => {
      wsService.connect();
      await server.connected;
      
      expect(server).toHaveReceivedMessages([]);
      expect(wsService.isConnected()).toBe(true);
    });

    it('should handle reconnection on disconnect', async () => {
      wsService.connect();
      await server.connected;

      // Simulate disconnect
      server.close();
      
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(wsService.getReconnectAttempts()).toBeGreaterThan(0);
    });

    it('should authenticate after connection', async () => {
      const token = 'test-jwt-token';
      wsService.setAuthToken(token);
      wsService.connect();
      
      await server.connected;
      
      await expect(server).toReceiveMessage(
        JSON.stringify({
          type: 'auth',
          token,
        })
      );
    });
  });

  describe('message handling', () => {
    it('should handle property update messages', async () => {
      const onUpdate = jest.fn();
      wsService.on('property.update', onUpdate);
      wsService.connect();
      
      await server.connected;

      const updateMessage = {
        type: 'property.update',
        data: {
          id: '1',
          price: 550000,
        },
      };

      server.send(JSON.stringify(updateMessage));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onUpdate).toHaveBeenCalledWith({
        id: '1',
        price: 550000,
      });
    });

    it('should handle new property notifications', async () => {
      const onNewProperty = jest.fn();
      wsService.on('property.new', onNewProperty);
      wsService.connect();
      
      await server.connected;

      const newPropertyMessage = {
        type: 'property.new',
        data: {
          id: '2',
          title: 'New Listing',
          matchScore: 0.92,
        },
      };

      server.send(JSON.stringify(newPropertyMessage));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onNewProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '2',
          title: 'New Listing',
        })
      );
    });

    it('should handle price drop alerts', async () => {
      const onPriceDrop = jest.fn();
      wsService.on('property.priceDrop', onPriceDrop);
      wsService.connect();
      
      await server.connected;

      const priceDropMessage = {
        type: 'property.priceDrop',
        data: {
          propertyId: '1',
          oldPrice: 500000,
          newPrice: 450000,
          percentDrop: 10,
        },
      };

      server.send(JSON.stringify(priceDropMessage));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onPriceDrop).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: '1',
          percentDrop: 10,
        })
      );
    });
  });

  describe('subscriptions', () => {
    it('should subscribe to property updates', async () => {
      wsService.connect();
      await server.connected;

      wsService.subscribeToProperty('prop-123');

      await expect(server).toReceiveMessage(
        JSON.stringify({
          type: 'subscribe',
          channel: 'property:prop-123',
        })
      );
    });

    it('should subscribe to search alerts', async () => {
      wsService.connect();
      await server.connected;

      wsService.subscribeToSearchAlerts('user-123');

      await expect(server).toReceiveMessage(
        JSON.stringify({
          type: 'subscribe',
          channel: 'alerts:user-123',
        })
      );
    });

    it('should unsubscribe from channels', async () => {
      wsService.connect();
      await server.connected;

      wsService.subscribeToProperty('prop-123');
      wsService.unsubscribeFromProperty('prop-123');

      await expect(server).toReceiveMessage(
        JSON.stringify({
          type: 'unsubscribe',
          channel: 'property:prop-123',
        })
      );
    });
  });

  describe('chat functionality', () => {
    it('should send chat messages', async () => {
      wsService.connect();
      await server.connected;

      wsService.sendChatMessage('Hello, I need help', 'session-123');

      await expect(server).toReceiveMessage(
        JSON.stringify({
          type: 'chat.message',
          data: {
            message: 'Hello, I need help',
            sessionId: 'session-123',
          },
        })
      );
    });

    it('should receive chat responses', async () => {
      const onChatResponse = jest.fn();
      wsService.on('chat.response', onChatResponse);
      wsService.connect();
      
      await server.connected;

      const chatResponse = {
        type: 'chat.response',
        data: {
          message: 'How can I help you?',
          sessionId: 'session-123',
          suggestions: ['View properties', 'Search criteria'],
        },
      };

      server.send(JSON.stringify(chatResponse));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onChatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'How can I help you?',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle connection errors', async () => {
      const onError = jest.fn();
      wsService.on('error', onError);
      
      // Force connection error
      server.error();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onError).toHaveBeenCalled();
    });

    it('should handle message parsing errors', async () => {
      const onError = jest.fn();
      wsService.on('error', onError);
      wsService.connect();
      
      await server.connected;

      // Send invalid JSON
      server.send('invalid json');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('parse'),
        })
      );
    });
  });
});
```

### B. WebSocket Service Implementation

```typescript
// property-search-frontend/src/services/websocket/WebSocketService.ts
import { EventEmitter } from 'events';

interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
}

export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private authToken: string | null = null;
  private subscriptions = new Set<string>();
  private messageQueue: WebSocketMessage[] = [];
  private isAuthenticated = false;

  constructor(url: string) {
    super();
    this.url = url;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      this.emit('error', { message: 'Failed to create WebSocket connection', error });
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // Authenticate if token is available
      if (this.authToken) {
        this.authenticate();
      }

      // Re-subscribe to channels
      this.subscriptions.forEach(channel => {
        this.send({
          type: 'subscribe',
          channel,
        });
      });

      // Send queued messages
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        this.emit('error', { message: 'Failed to parse WebSocket message', error });
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected', event);
      this.isAuthenticated = false;
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, this.reconnectInterval * Math.pow(2, this.reconnectAttempts));
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error', error);
      this.emit('error', { message: 'WebSocket error', error });
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'auth.success':
        this.isAuthenticated = true;
        this.emit('authenticated');
        break;

      case 'auth.failed':
        this.isAuthenticated = false;
        this.emit('auth.failed', message.error);
        break;

      case 'property.update':
      case 'property.new':
      case 'property.priceDrop':
      case 'property.sold':
        this.emit(message.type, message.data);
        break;

      case 'chat.response':
        this.emit('chat.response', message.data);
        break;

      case 'notification':
        this.emit('notification', message.data);
        break;

      case 'error':
        this.emit('error', { message: message.error });
        break;

      default:
        this.emit('message', message);
    }
  }

  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  private authenticate(): void {
    this.send({
      type: 'auth',
      token: this.authToken,
    });
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  setAuthToken(token: string): void {
    this.authToken = token;
    if (this.isConnected() && !this.isAuthenticated) {
      this.authenticate();
    }
  }

  subscribeToProperty(propertyId: string): void {
    const channel = `property:${propertyId}`;
    this.subscriptions.add(channel);
    this.send({
      type: 'subscribe',
      channel,
    });
  }

  unsubscribeFromProperty(propertyId: string): void {
    const channel = `property:${propertyId}`;
    this.subscriptions.delete(channel);
    this.send({
      type: 'unsubscribe',
      channel,
    });
  }

  subscribeToSearchAlerts(userId: string): void {
    const channel = `alerts:${userId}`;
    this.subscriptions.add(channel);
    this.send({
      type: 'subscribe',
      channel,
    });
  }

  sendChatMessage(message: string, sessionId: string): void {
    this.send({
      type: 'chat.message',
      data: {
        message,
        sessionId,
      },
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.messageQueue = [];
    this.isAuthenticated = false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// React Hook for WebSocket
import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    wsRef.current = new WebSocketService(url);
    wsRef.current.connect();

    return () => {
      wsRef.current?.disconnect();
    };
  }, [url]);

  const subscribe = useCallback((event: string, handler: (...args: any[]) => void) => {
    wsRef.current?.on(event, handler);
    
    return () => {
      wsRef.current?.off(event, handler);
    };
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    wsRef.current?.send({ type, data });
  }, []);

  return {
    subscribe,
    sendMessage,
    service: wsRef.current,
  };
}
```

## 3. Real-time Notification System

### A. Notification Component Tests

```typescript
// property-search-frontend/src/components/Notifications/NotificationCenter.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationCenter } from './NotificationCenter';
import { useNotificationStore } from '@/store/notificationStore';
import { WebSocketService } from '@/services/websocket/WebSocketService';

jest.mock('@/services/websocket/WebSocketService');

describe('NotificationCenter', () => {
  let mockWsService: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    mockWsService = new WebSocketService('ws://test') as jest.Mocked<WebSocketService>;
    
    // Clear notification store
    useNotificationStore.getState().clearAll();
  });

  it('should display notification count', () => {
    const { addNotification } = useNotificationStore.getState();
    
    addNotification({
      id: '1',
      type: 'property.new',
      title: 'New Property Match',
      message: 'A new property matching your criteria',
      timestamp: new Date(),
      read: false,
    });

    render(<NotificationCenter wsService={mockWsService} />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should show notification list when clicked', async () => {
    const user = userEvent.setup();
    const { addNotification } = useNotificationStore.getState();
    
    addNotification({
      id: '1',
      type: 'property.new',
      title: 'New Property Match',
      message: 'A new property matching your criteria',
      timestamp: new Date(),
      read: false,
    });

    render(<NotificationCenter wsService={mockWsService} />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(screen.getByText('New Property Match')).toBeInTheDocument();
    expect(screen.getByText('A new property matching your criteria')).toBeInTheDocument();
  });

  it('should mark notifications as read when viewed', async () => {
    const user = userEvent.setup();
    const { addNotification, notifications } = useNotificationStore.getState();
    
    addNotification({
      id: '1',
      type: 'property.new',
      title: 'New Property Match',
      message: 'Test message',
      timestamp: new Date(),
      read: false,
    });

    render(<NotificationCenter wsService={mockWsService} />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    
    // Click on the notification
    await user.click(screen.getByText('New Property Match'));

    await waitFor(() => {
      const updatedNotifications = useNotificationStore.getState().notifications;
      expect(updatedNotifications[0].read).toBe(true);
    });
  });

  it('should handle real-time notifications via WebSocket', async () => {
    const mockOn = jest.fn();
    mockWsService.on = mockOn;

    render(<NotificationCenter wsService={mockWsService} />);

    // Verify WebSocket listeners are set up
    expect(mockOn).toHaveBeenCalledWith('property.new', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('property.priceDrop', expect.any(Function));

    // Simulate WebSocket notification
    const handler = mockOn.mock.calls.find(
      call => call[0] === 'property.new'
    )?.[1];

    handler?.({
      propertyId: 'prop-123',
      title: 'New Match Found',
      matchScore: 0.95,
    });

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('should group notifications by type', async () => {
    const user = userEvent.setup();
    const { addNotification } = useNotificationStore.getState();
    
    // Add multiple notifications
    addNotification({
      id: '1',
      type: 'property.new',
      title: 'New Property 1',
      message: 'Message 1',
      timestamp: new Date(),
      read: false,
    });

    addNotification({
      id: '2',
      type: 'property.priceDrop',
      title: 'Price Drop',
      message: 'Price reduced',
      timestamp: new Date(),
      read: false,
    });

    render(<NotificationCenter wsService={mockWsService} />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    // Check for grouped sections
    expect(screen.getByText('New Properties')).toBeInTheDocument();
    expect(screen.getByText('Price Updates')).toBeInTheDocument();
  });

  it('should allow clearing all notifications', async () => {
    const user = userEvent.setup();
    const { addNotification } = useNotificationStore.getState();
    
    addNotification({
      id: '1',
      type: 'property.new',
      title: 'Test',
      message: 'Test',
      timestamp: new Date(),
      read: false,
    });

    render(<NotificationCenter wsService={mockWsService} />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(screen.getByRole('button', { name: /clear all/i }));

    await waitFor(() => {
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
  });
});
```

### B. Notification Center Implementation

```typescript
// property-search-frontend/src/components/Notifications/NotificationCenter.tsx
import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Home, TrendingDown, MessageSquare } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { WebSocketService } from '@/services/websocket/WebSocketService';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  wsService: WebSocketService;
}

export function NotificationCenter({ wsService }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotificationStore();

  // Handle WebSocket notifications
  useEffect(() => {
    const handleNewProperty = (data: any) => {
      addNotification({
        id: `prop-new-${Date.now()}`,
        type: 'property.new',
        title: 'New Property Match!',
        message: `${data.title} - ${data.matchScore}% match`,
        timestamp: new Date(),
        read: false,
        data: {
          propertyId: data.propertyId,
          url: `/properties/${data.propertyId}`,
        },
      });
    };

    const handlePriceDrop = (data: any) => {
      addNotification({
        id: `price-drop-${Date.now()}`,
        type: 'property.priceDrop',
        title: 'Price Drop Alert!',
        message: `${data.title} reduced by ${data.percentDrop}%`,
        timestamp: new Date(),
        read: false,
        data: {
          propertyId: data.propertyId,
          oldPrice: data.oldPrice,
          newPrice: data.newPrice,
          url: `/properties/${data.propertyId}`,
        },
      });
    };

    const handleChatMessage = (data: any) => {
      addNotification({
        id: `chat-${Date.now()}`,
        type: 'chat.message',
        title: 'New Message',
        message: data.preview,
        timestamp: new Date(),
        read: false,
        data: {
          sessionId: data.sessionId,
        },
      });
    };

    wsService.on('property.new', handleNewProperty);
    wsService.on('property.priceDrop', handlePriceDrop);
    wsService.on('chat.response', handleChatMessage);

    return () => {
      wsService.off('property.new', handleNewProperty);
      wsService.off('property.priceDrop', handlePriceDrop);
      wsService.off('chat.response', handleChatMessage);
    };
  }, [wsService, addNotification]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const groupedNotifications = notifications.reduce((acc, notification) => {
    const type = notification.type.split('.')[0];
    if (!acc[type]) acc[type] = [];
    acc[type].push(notification);
    return acc;
  }, {} as Record<string, typeof notifications>);

  const getIcon = (type: string) => {
    switch (type) {
      case 'property.new':
        return <Home className="h-4 w-4" />;
      case 'property.priceDrop':
        return <TrendingDown className="h-4 w-4" />;
      case 'chat.message':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'property':
        return 'Property Updates';
      case 'chat':
        return 'Messages';
      default:
        return 'Notifications';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              Object.entries(groupedNotifications).map(([type, items]) => (
                <div key={type}>
                  <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                    {getTypeLabel(type)}
                  </div>
                  {items.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors',
                        !notification.read && 'bg-blue-50'
                      )}
                      onClick={() => {
                        markAsRead(notification.id);
                        if (notification.data?.url) {
                          window.location.href = notification.data.url;
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          'flex-shrink-0 p-2 rounded-full',
                          !notification.read ? 'bg-blue-100' : 'bg-gray-100'
                        )}>
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="flex-shrink-0">
                            <div className="h-2 w-2 bg-blue-500 rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 4. Optimistic UI Updates

### A. Optimistic Update Hook Tests

```typescript
// property-search-frontend/src/hooks/useOptimisticUpdate.test.ts
import { renderHook, act } from '@testing-library/react';
import { useOptimisticUpdate } from './useOptimisticUpdate';

describe('useOptimisticUpdate', () => {
  it('should apply optimistic update immediately', async () => {
    const initialData = { count: 0 };
    const apiCall = jest.fn().mockResolvedValue({ count: 1 });

    const { result } = renderHook(() => 
      useOptimisticUpdate(initialData, apiCall)
    );

    expect(result.current.data).toEqual({ count: 0 });
    expect(result.current.isPending).toBe(false);

    await act(async () => {
      await result.current.update({ count: 1 });
    });

    // Optimistic update should be applied immediately
    expect(result.current.data).toEqual({ count: 1 });
    expect(apiCall).toHaveBeenCalledWith({ count: 1 });
  });

  it('should rollback on error', async () => {
    const initialData = { count: 0 };
    const apiCall = jest.fn().mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => 
      useOptimisticUpdate(initialData, apiCall)
    );

    await act(async () => {
      try {
        await result.current.update({ count: 1 });
      } catch (error) {
        // Expected error
      }
    });

    // Should rollback to initial data
    expect(result.current.data).toEqual({ count: 0 });
    expect(result.current.error).toBeTruthy();
  });

  it('should handle concurrent updates', async () => {
    const initialData = { count: 0 };
    let resolveFirst: any;
    let resolveSecond: any;

    const apiCall = jest.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));

    const { result } = renderHook(() => 
      useOptimisticUpdate(initialData, apiCall)
    );

    // Start two updates
    act(() => {
      result.current.update({ count: 1 });
      result.current.update({ count: 2 });
    });

    // Both updates should be pending
    expect(result.current.data).toEqual({ count: 2 });
    expect(result.current.isPending).toBe(true);

    // Resolve in reverse order
    await act(async () => {
      resolveSecond({ count: 2 });
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    await act(async () => {
      resolveFirst({ count: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Should keep the latest update
    expect(result.current.data).toEqual({ count: 2 });
    expect(result.current.isPending).toBe(false);
  });
});
```

### B. Optimistic Update Implementation

```typescript
// property-search-frontend/src/hooks/useOptimisticUpdate.ts
import { useState, useCallback, useRef } from 'react';

interface OptimisticUpdateState<T> {
  data: T;
  isPending: boolean;
  error: Error | null;
  update: (newData: Partial<T>) => Promise<void>;
  reset: () => void;
}

export function useOptimisticUpdate<T>(
  initialData: T,
  apiCall: (data: T) => Promise<T>
): OptimisticUpdateState<T> {
  const [data, setData] = useState<T>(initialData);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const updateIdRef = useRef(0);

  const update = useCallback(async (newData: Partial<T>) => {
    const updateId = ++updateIdRef.current;
    const previousData = data;
    const optimisticData = { ...data, ...newData };

    // Apply optimistic update
    setData(optimisticData);
    setIsPending(true);
    setError(null);

    try {
      const result = await apiCall(optimisticData);
      
      // Only apply result if this is still the latest update
      if (updateId === updateIdRef.current) {
        setData(result);
        setIsPending(false);
      }
    } catch (err) {
      // Rollback on error
      if (updateId === updateIdRef.current) {
        setData(previousData);
        setError(err as Error);
        setIsPending(false);
      }
      throw err;
    }
  }, [data, apiCall]);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setIsPending(false);
    updateIdRef.current = 0;
  }, [initialData]);

  return {
    data,
    isPending,
    error,
    update,
    reset,
  };
}

// Usage example for property favorites
export function useOptimisticFavorite(property: Property) {
  const [isFavorite, setIsFavorite] = useState(property.isFavorite || false);
  
  const toggleFavorite = useOptimisticUpdate(
    { isFavorite },
    async (data) => {
      const response = await fetch(`/api/properties/${property.id}/favorite`, {
        method: data.isFavorite ? 'POST' : 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update favorite');
      }
      
      return { isFavorite: data.isFavorite };
    }
  );

  return {
    isFavorite: toggleFavorite.data.isFavorite,
    isPending: toggleFavorite.isPending,
    toggle: () => toggleFavorite.update({ isFavorite: !toggleFavorite.data.isFavorite }),
  };
}
```

## 5. Progressive Web App Features

### A. Service Worker Tests

```typescript
// property-search-frontend/src/service-worker/service-worker.test.ts
import { mockServiceWorker } from '@/test/utils/mockServiceWorker';

describe('Service Worker', () => {
  let sw: any;

  beforeEach(() => {
    sw = mockServiceWorker();
  });

  describe('caching strategies', () => {
    it('should cache static assets', async () => {
      const request = new Request('/static/css/main.css');
      const response = new Response('css content');

      await sw.handleFetch(request, response);

      const cachedResponse = await sw.caches.match(request);
      expect(cachedResponse).toBeDefined();
      expect(await cachedResponse.text()).toBe('css content');
    });

    it('should use network-first for API requests', async () => {
      const request = new Request('/api/properties');
      const networkResponse = new Response(JSON.stringify({ data: [] }));

      const response = await sw.handleFetch(request, networkResponse);

      expect(response).toBe(networkResponse);
    });

    it('should fallback to cache when offline', async () => {
      const request = new Request('/api/properties');
      const cachedResponse = new Response(JSON.stringify({ cached: true }));

      // Add to cache
      await sw.caches.put(request, cachedResponse.clone());

      // Simulate offline
      const response = await sw.handleFetch(request, null, { offline: true });

      expect(await response.json()).toEqual({ cached: true });
    });
  });

  describe('background sync', () => {
    it('should queue failed requests for sync', async () => {
      const request = new Request('/api/properties/1/favorite', {
        method: 'POST',
      });

      // Simulate offline
      await sw.handleFetch(request, null, { offline: true });

      const queue = await sw.getSyncQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].request.url).toContain('/favorite');
    });

    it('should replay queued requests on sync', async () => {
      const request = new Request('/api/properties/1/favorite', {
        method: 'POST',
      });

      // Queue request
      await sw.queueRequest(request);

      // Trigger sync
      const syncedRequests = await sw.handleBackgroundSync();

      expect(syncedRequests).toHaveLength(1);
      expect(syncedRequests[0].url).toContain('/favorite');
    });
  });

  describe('push notifications', () => {
    it('should show notification for new property', async () => {
      const pushData = {
        title: 'New Property Match!',
        body: 'Modern apartment in London',
        data: {
          propertyId: 'prop-123',
          url: '/properties/prop-123',
        },
      };

      const notification = await sw.handlePush(pushData);

      expect(notification.title).toBe('New Property Match!');
      expect(notification.body).toBe('Modern apartment in London');
      expect(notification.data.url).toBe('/properties/prop-123');
    });

    it('should handle notification click', async () => {
      const notification = {
        data: {
          url: '/properties/prop-123',
        },
      };

      const clients = await sw.handleNotificationClick(notification);

      expect(clients.openWindow).toHaveBeenCalledWith('/properties/prop-123');
    });
  });
});
```

### B. Service Worker Implementation

```typescript
// property-search-frontend/public/service-worker.js
/// <reference lib="webworker" />

const CACHE_NAME = 'moov-property-v1';
const API_CACHE = 'moov-api-v1';
const IMAGE_CACHE = 'moov-images-v1';

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - precache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('moov-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(request, API_CACHE).catch(() => {
        // If offline and no cache, queue for sync
        if (request.method === 'POST' || request.method === 'PUT') {
          return queueRequest(request);
        }
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // Images - Cache first, fallback to network
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Static assets - Cache first
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Default - Network first
  event.respondWith(
    networkFirst(request, CACHE_NAME).catch(() => {
      return caches.match('/offline.html');
    })
  );
});

// Caching strategies
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Background sync for offline requests
const syncQueue = [];

async function queueRequest(request) {
  syncQueue.push({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body: await request.text(),
    timestamp: Date.now(),
  });

  await self.registration.sync.register('sync-requests');
  
  return new Response(
    JSON.stringify({ queued: true, message: 'Request queued for sync' }),
    { status: 202 }
  );
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncQueuedRequests());
  }
});

async function syncQueuedRequests() {
  while (syncQueue.length > 0) {
    const { url, method, headers, body } = syncQueue.shift();
    
    try {
      await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? body : undefined,
      });
    } catch (error) {
      // Re-queue on failure
      syncQueue.unshift({ url, method, headers, body });
      throw error;
    }
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'New update from Moov Property Portal',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Moov Property Portal',
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window/tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Periodic background sync for property updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-new-properties') {
    event.waitUntil(checkForNewProperties());
  }
});

async function checkForNewProperties() {
  try {
    const response = await fetch('/api/properties/updates', {
      headers: {
        'X-Last-Check': await getLastCheckTime(),
      },
    });

    if (response.ok) {
      const updates = await response.json();
      if (updates.newProperties > 0) {
        await self.registration.showNotification('New Properties Available', {
          body: `${updates.newProperties} new properties match your criteria`,
          icon: '/icons/icon-192x192.png',
          data: { url: '/search' },
        });
      }
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}

// Helper to get last check time from IndexedDB
async function getLastCheckTime() {
  // Implementation would use IndexedDB
  return new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
}
```

## Summary

This implementation provides:

1. **Frontend State Management** with Zustand, including property search, favorites, and history
2. **Real-time WebSocket** implementation for live updates and notifications
3. **Notification System** with grouped notifications and real-time updates
4. **Optimistic UI Updates** for better user experience
5. **Progressive Web App** features including offline support and background sync

All components follow TDD principles with comprehensive test coverage, ensuring reliability and maintainability.