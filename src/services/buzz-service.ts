interface WebSocketMessage {
  type: string;
  data?: any;
  userId?: string;
  timestamp?: number;
}

interface WebSocketServiceCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onUserCountUpdate?: (count: number) => void;
  onAudioReceived?: (audioData: ArrayBuffer) => void;
  onError?: (error: string) => void;
  onMaxRetryExceeded?: (retryCount: number) => void;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private callbacks: WebSocketServiceCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private serverUrl: string = '';
  private isConnecting = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true; // Flag to control reconnection
  private isDestroyed = false; // Flag to prevent operations after cleanup

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public setCallbacks(callbacks: WebSocketServiceCallbacks): void {
    if (this.isDestroyed) return;
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public async connect(serverUrl: string): Promise<void> {
    if (this.isDestroyed) {
      console.log('WebSocketService is destroyed, cannot connect');
      return;
    }

    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('Already connecting to WebSocket');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    // Clear any existing reconnection timeout
    this.clearReconnectTimeout();

    this.serverUrl = serverUrl;
    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      console.log('Connecting to WebSocket:', serverUrl);
      
      // Close existing connection if any
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
        this.ws = null;
      }

      this.ws = new WebSocket(serverUrl);

      this.ws.onopen = () => {
        if (this.isDestroyed) return;
        console.log('WebSocket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.callbacks.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        if (this.isDestroyed) return;
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        if (this.isDestroyed) return;
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;
        this.callbacks.onDisconnect?.();
        
        // Only attempt to reconnect if it wasn't a clean close and we should reconnect
        if (event.code !== 1000 && this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else if (event.code !== 1000 && this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.callbacks.onMaxRetryExceeded?.(this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        if (this.isDestroyed) return;
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.callbacks.onError?.('WebSocket connection error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      if (!this.isDestroyed) {
        this.callbacks.onError?.('Failed to create WebSocket connection');
      }
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (this.isDestroyed) return;
    
    try {
      // Handle both text and binary messages
      if (typeof event.data === 'string') {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'stats_update':
            const userCount = (message as any).stats?.usersOnline || 0;
            this.callbacks.onUserCountUpdate?.(userCount as number);
            break;
          
          default:
            console.log('Unknown message type:', message.type);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Handle binary audio data
        this.callbacks.onAudioReceived?.(event.data);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  public sendAudio(audioData: ArrayBuffer): void {
    if (this.isDestroyed || !this.isConnected()) {
      console.warn('Cannot send audio: WebSocket not connected or service destroyed');
      return;
    }

    try {
      if (this.ws) {
        this.ws.send(audioData);
        console.log('Audio sent, size:', audioData.byteLength, 'bytes');
      }
    } catch (error) {
      console.error('Failed to send audio:', error);
      if (!this.isDestroyed) {
        this.callbacks.onError?.('Failed to send audio');
      }
    }
  }

  public sendMessage(message: WebSocketMessage): void {
    if (this.isDestroyed || !this.isConnected()) {
      console.warn('Cannot send message: WebSocket not connected or service destroyed');
      return;
    }

    try {
      this.ws?.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      if (!this.isDestroyed) {
        this.callbacks.onError?.('Failed to send message');
      }
    }
  }

  public isConnected(): boolean {
    return !this.isDestroyed && this.ws?.readyState === WebSocket.OPEN;
  }

  public disconnect(): void {
    console.log('Disconnecting WebSocket service');
    this.shouldReconnect = false;
    this.clearReconnectTimeout();
    
    if (this.ws) {
      // Clean up event handlers to prevent memory leaks
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'User disconnected');
      }
      this.ws = null;
    }
    
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  public destroy(): void {
    console.log('Destroying WebSocket service');
    this.isDestroyed = true;
    this.shouldReconnect = false;
    this.disconnect();
    this.callbacks = {};
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || !this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts && !this.isDestroyed) {
        console.log('Max reconnection attempts reached');
        this.callbacks.onMaxRetryExceeded?.(this.reconnectAttempts);
      }
      return;
    }

    this.clearReconnectTimeout();
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 2 * 60 * 1000); // Cap at 2 mins
    
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.isDestroyed || !this.shouldReconnect) return;
      
      if (this.serverUrl) {
        this.connect(this.serverUrl);
      }
    }, delay);
  }

  public stopReconnecting(): void {
    console.log('Stopping reconnection attempts');
    this.shouldReconnect = false;
    this.clearReconnectTimeout();
  }

  public getConnectionInfo() {
    return {
      connected: this.isConnected(),
      url: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.ws?.readyState,
      shouldReconnect: this.shouldReconnect,
      isDestroyed: this.isDestroyed
    };
  }

  // Reset the service state (useful for testing or reinitialization)
  public reset(): void {
    this.disconnect();
    this.isDestroyed = false;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.serverUrl = '';
    this.isConnecting = false;
  }
}

export const webSocketService = WebSocketService.getInstance();