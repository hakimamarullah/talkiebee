interface Profile {
  name: string;
  age: number;
  gender: string;
  lookingFor: string;
  location: string | null;
}

interface Partner {
  name?: string;
  age?: number;
  gender?: string;
  location?: string;
  [key: string]: any;
}

interface Stats {
  usersOnline: number;
}

interface WebSocketMessage {
  type: string;
  profile?: Profile;
  partner?: Partner;
  message?: string;
  reason?: string;
  stats?: Stats;
  [key: string]: any;
}

type EventCallback = (...args: any[]) => void;

// Platform detection utility
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentProfile: Profile | null = null;

  // WebSocket server URL - update this to match your server
  private readonly WS_URL = 'wss://ultimate-polliwog-climbing.ngrok-free.app/ws';

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // Event listener management
  public on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Convenience methods for common events
  public onConnect(callback: EventCallback): void {
    this.on('connect', callback);
  }

  public onDisconnect(callback: EventCallback): void {
    this.on('disconnect', callback);
  }

  public onMatchFound(callback: (partner: Partner) => void): void {
    this.on('match_found', callback);
  }

  public onMatchEnded(callback: (reason?: string) => void): void {
    this.on('match_ended', callback);
  }

  public onNoMatches(callback: EventCallback): void {
    this.on('no_matches', callback);
  }

  public onStatsUpdate(callback: (stats: Stats) => void): void {
    this.on('stats_update', callback);
  }

  public onPartnerDisconnected(callback: EventCallback): void {
    this.on('partner_disconnected', callback);
  }

  public onAudioReceived(callback: (audioBase64: string) => void): void {
    this.on('audio_received', callback);
  }

  public onError(callback: (error: string) => void): void {
    this.on('error', callback);
  }

  public removeAllListeners(): void {
    this.eventListeners.clear();
  }

  // Connection management
  public async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.WS_URL);
        
        // Set binary type for receiving ArrayBuffer
        if (!isReactNative) {
          this.ws.binaryType = 'arraybuffer';
        }

        const connectionTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000); // 10 second timeout

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connect');
          this.log('✅ Connected to dating server');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.handleDisconnection(event);
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocket error:', error);
          this.emit('error', 'Connection failed');
          reject(new Error('Connection failed'));
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      // Send end session message before closing
      this.sendMessage({
        type: 'end_session'
      });

      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.currentProfile = null;
    this.emit('disconnect');
    this.log('👋 Disconnected from dating server');
  }

  private handleDisconnection(event: CloseEvent): void {
    this.isConnected = false;
    this.emit('disconnect');
    
    if (event.code !== 1000) { // Not a normal closure
      this.log(`💔 Connection lost (${event.code})`);
      this.attemptReconnect();
    } else {
      this.log('💔 Disconnected from dating server');
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', 'Failed to reconnect after multiple attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 2 * 60 * 1000); // Exponential backoff, max 10s

    this.log(`🔄 Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        
        // If we had a profile and were matching, resume matching
        if (this.currentProfile) {
          await this.findMatch(this.currentProfile);
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  // Handle binary data (audio) and JSON messages
  private handleMessage(event: MessageEvent): void {
    console.log('=== WEBSOCKET MESSAGE DEBUG ===');
    console.log('Message type:', typeof event.data);
    console.log('Message constructor:', event.data?.constructor?.name);
    
    // Handle binary data (audio)
    if (event.data instanceof ArrayBuffer) {
      console.log('Received ArrayBuffer, size:', event.data.byteLength);
      const base64String = this.arrayBufferToBase64(event.data);
      console.log('Converted to base64, length:', base64String.length);
      this.emit('audio_received', base64String);
      this.log('📥 Received voice message');
      return;
    }

    // React Native might receive Blob-like objects
    if (typeof event.data === 'object' && event.data.constructor.name === 'Blob') {
      console.log('Received Blob, size:', event.data.size);
      this.blobToArrayBuffer(event.data).then(arrayBuffer => {
        console.log('Converted Blob to ArrayBuffer, size:', arrayBuffer.byteLength);
        const base64String = this.arrayBufferToBase64(arrayBuffer);
        this.emit('audio_received', base64String);
        this.log('📥 Received voice message');
      }).catch(error => {
        console.error('Failed to process audio blob:', error);
        this.emit('error', 'Failed to process received audio');
      });
      return;
    }

    // Handle JSON messages
    if (typeof event.data === 'string') {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleJsonMessage(message);
      } catch (error) {
        // If it's not JSON, might be base64 audio sent as string (fallback)
        console.log('Received string data, length:', event.data.length);
        if (event.data.length > 1000) { // Likely audio data
          console.log('Treating string as base64 audio');
          this.emit('audio_received', event.data);
          this.log('📥 Received voice message (string format)');
        } else {
          console.error('Error parsing WebSocket message:', error);
          this.emit('error', 'Invalid message format');
        }
      }
      return;
    }

    console.warn('Received unknown message type:', typeof event.data, event.data);
  }

  // Convert ArrayBuffer to base64 string - optimized version
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks to prevent call stack overflow
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Remove data URI prefix if present
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Convert Blob to ArrayBuffer (for React Native compatibility)
  private async blobToArrayBuffer(blob: any): Promise<ArrayBuffer> {
    if (blob.arrayBuffer) {
      return await blob.arrayBuffer();
    }
    
    // Fallback for environments that don't support arrayBuffer()
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  private handleJsonMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'connected':
        this.log(message.message || '✅ Connected to server');
        break;

      case 'match_found':
        if (message.partner) {
          this.emit('match_found', message.partner);
          this.log(`💖 Matched with ${message.partner.name || 'someone special'}`);
        }
        break;

      case 'match_ended':
        this.emit('match_ended', message.reason);
        this.log('💔 Match ended');
        break;

      case 'partner_disconnected':
        this.emit('partner_disconnected');
        this.emit('match_ended', 'Partner disconnected');
        this.log('😔 Partner disconnected');
        break;

      case 'no_matches':
        this.emit('no_matches');
        this.log('😔 No matches available, retrying...');
        break;

      case 'stats_update':
        if (message.stats) {
          this.emit('stats_update', message.stats);
        }
        break;

      case 'error':
        this.emit('error', message.message || 'Server error');
        this.log(`❌ ${message.message || 'Server error'}`);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  // Messaging methods
  private sendMessage(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
      this.emit('error', 'Not connected to server');
    }
  }

  public async findMatch(profile: Profile): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    this.currentProfile = profile;
    
    this.sendMessage({
      type: 'find_match',
      profile: profile
    });

    this.log('🔍 Looking for compatible matches...');
  }

  public endMatch(): void {
    this.sendMessage({
      type: 'end_match'
    });
    this.log('⭐️ Looking for next match...');
  }

  // Updated sendAudio method - sends binary data directly
  public async sendAudio(audioData: ArrayBuffer | string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit('error', 'Cannot send audio: not connected');
      throw new Error('WebSocket not connected');
    }

    try {
      let audioBuffer: ArrayBuffer;

      if (audioData instanceof ArrayBuffer) {
        audioBuffer = audioData;
      } else if (typeof audioData === 'string') {
        // Convert base64 string to ArrayBuffer
        audioBuffer = this.base64ToArrayBuffer(audioData);
      } else {
        throw new Error('Unsupported audio data format. Expected ArrayBuffer or base64 string.');
      }

      // Send binary data directly
      this.ws.send(audioBuffer);
      this.log(`📤 Sent voice message (${audioBuffer.byteLength} bytes)`);

    } catch (error) {
      console.error('Failed to send audio:', error);
      this.emit('error', 'Failed to send audio');
      throw error;
    }
  }

  // Utility methods
  public isConnectedToServer(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
    
    // Emit log event for UI components that want to show logs
    this.emit('log', message, timestamp);
  }

  // Static method to create and return singleton instance
  public static create(): WebSocketService {
    return WebSocketService.getInstance();
  }
}

// Export singleton instance for convenience
export const wsService = WebSocketService.getInstance();