export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  authToken?: string;
}

export type WebSocketEventHandler = (data: any) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private isConnected = false;
  private authToken: string | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      ...config,
    };
    this.authToken = config.authToken || null;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          
          // Send authentication if token is available
          if (this.authToken) {
            this.send({
              type: 'auth',
              token: this.authToken,
            });
          }

          this.emit('connected', null);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          if (!event.wasClean && this.shouldReconnect()) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
  }

  send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return false;
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now(),
      };
      
      this.ws.send(JSON.stringify(messageWithTimestamp));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'pong':
        // Heartbeat response
        break;
      case 'property_update':
        this.emit('propertyUpdate', message.data);
        break;
      case 'new_property':
        this.emit('newProperty', message.data);
        break;
      case 'price_change':
        this.emit('priceChange', message.data);
        break;
      case 'market_update':
        this.emit('marketUpdate', message.data);
        break;
      case 'user_notification':
        this.emit('notification', message.data);
        break;
      default:
        this.emit(message.type, message.data);
    }
  }

  private shouldReconnect(): boolean {
    return this.reconnectAttempts < (this.config.maxReconnectAttempts || 5);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        if (this.shouldReconnect()) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.config.heartbeatInterval!);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Public getters
  getConnectionState(): number {
    return this.ws?.readyState || WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
    
    // If already connected, send auth message
    if (this.isConnected) {
      this.send({
        type: 'auth',
        token,
      });
    }
  }

  // Property-specific methods
  subscribeToProperty(propertyId: string): void {
    this.send({
      type: 'subscribe_property',
      data: { propertyId },
    });
  }

  unsubscribeFromProperty(propertyId: string): void {
    this.send({
      type: 'unsubscribe_property',
      data: { propertyId },
    });
  }

  subscribeToMarketUpdates(location: string): void {
    this.send({
      type: 'subscribe_market',
      data: { location },
    });
  }

  subscribeToSearchAlerts(searchCriteria: any): void {
    this.send({
      type: 'subscribe_search_alerts',
      data: searchCriteria,
    });
  }
}

// Singleton instance
let wsInstance: WebSocketService | null = null;

export function getWebSocketService(config?: WebSocketConfig): WebSocketService {
  if (!wsInstance && config) {
    wsInstance = new WebSocketService(config);
  }
  
  if (!wsInstance) {
    throw new Error('WebSocket service not initialized. Provide config on first call.');
  }
  
  return wsInstance;
}

// React hook for WebSocket
export function useWebSocket(config?: WebSocketConfig) {
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const wsRef = React.useRef<WebSocketService | null>(null);

  React.useEffect(() => {
    if (config) {
      wsRef.current = new WebSocketService(config);
      
      wsRef.current.on('connected', () => setIsConnected(true));
      wsRef.current.on('disconnected', () => setIsConnected(false));
      wsRef.current.on('error', setError);

      wsRef.current.connect().catch(setError);

      return () => {
        wsRef.current?.disconnect();
      };
    }
  }, [config?.url]);

  const send = React.useCallback((message: WebSocketMessage) => {
    return wsRef.current?.send(message) || false;
  }, []);

  const subscribe = React.useCallback((event: string, handler: WebSocketEventHandler) => {
    wsRef.current?.on(event, handler);
    
    return () => {
      wsRef.current?.off(event, handler);
    };
  }, []);

  return {
    isConnected,
    error,
    send,
    subscribe,
    service: wsRef.current,
  };
}