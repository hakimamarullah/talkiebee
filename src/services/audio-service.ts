import { AudioPlayer, AudioModule, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

interface AudioServiceCallbacks {
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onPlaybackStart?: () => void;
  onPlaybackFinish?: () => void;
  onError?: (error: string) => void;
}

// Platform detection utility
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

export class AudioService {
  private static instance: AudioService;
  private player: AudioPlayer | null = null;
  private callbacks: AudioServiceCallbacks = {};

  private constructor() {
    this.setupAudio();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  private async setupAudio() {
    try {
      if (isReactNative) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) throw new Error('Audio permission not granted');

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
      } else {
        // Web audio context setup
        if (typeof window !== 'undefined' && window.AudioContext) {
          // Basic web audio setup - you might want to expand this
          console.log('Web audio context available');
        }
      }
      console.log('Audio system ready');
    } catch (error) {
      console.error('Failed to setup audio system:', error);
      this.callbacks.onError?.('Failed to setup audio system');
    }
  }

  public setCallbacks(callbacks: AudioServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public initPlayer(player?: AudioPlayer) {
    if (isReactNative && player) {
      this.player = player;
      
      // Set up player event listeners
      this.player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          this.callbacks.onPlaybackFinish?.();
        }
      });
    } else if (!isReactNative) {
      // For web, we'll use HTML5 Audio API
      console.log('Web audio player will be created as needed');
    }
  }

  public async playAudio(base64Audio: string) {
    try {
      console.log('=== AUDIO PLAYBACK DEBUG ===');
      console.log('Platform:', isReactNative ? 'React Native' : 'Web');
      console.log('Base64 length:', base64Audio.length);
      console.log('Base64 preview:', base64Audio.substring(0, 100) + '...');
      
      if (isReactNative) {
        await this.playAudioReactNative(base64Audio);
      } else {
        await this.playAudioWeb(base64Audio);
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.callbacks.onError?.('Failed to play audio');
    }
  }

  private async playAudioReactNative(base64Audio: string) {
    if (!this.player) {
      console.warn('Player not initialized');
      return;
    }

    console.log('Processing audio for React Native...');
    
    try {
      // Try to detect the audio format from the base64 data
      const audioFormat = this.detectAudioFormat(base64Audio);
      console.log('Detected audio format:', audioFormat);
      
      const uri = await this.saveBase64Audio(base64Audio, audioFormat);
      console.log('Saved audio to:', uri);
      
      // Verify file was created
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Audio file was not created properly');
      }
  
      // Replace the current audio source
      await this.player.replace({ uri });
      console.log('Audio source replaced');
      
      // Play the audio
      await this.player.play();
      console.log('Audio playback started');
      this.callbacks.onPlaybackStart?.();
      
    } catch (error) {
      console.error('React Native audio playback error:', error);
      throw error;
    }
  }

  private async playAudioWeb(base64Audio: string) {
    try {
      console.log('Processing audio for Web...');
      
      // Detect audio format
      const audioFormat = this.detectAudioFormat(base64Audio);
      console.log('Detected audio format:', audioFormat);
      
      // Create data URL with proper MIME type
      let dataUrl;
      if (base64Audio.startsWith('data:')) {
        dataUrl = base64Audio;
      } else {
        // Use detected format or fallback
        const mimeType = this.getMimeTypeFromFormat(audioFormat);
        dataUrl = `data:${mimeType};base64,${base64Audio}`;
      }

      console.log('Data URL preview:', dataUrl.substring(0, 100) + '...');

      // Create HTML5 Audio element
      const audio = new Audio();
      
      // Add comprehensive event listeners for debugging
      audio.onloadstart = () => {
        console.log('Audio load started');
        this.callbacks.onPlaybackStart?.();
      };
      
      audio.oncanplay = () => {
        console.log('Audio can play');
      };
      
      audio.onended = () => {
        console.log('Audio playback ended');
        this.callbacks.onPlaybackFinish?.();
      };
      
      audio.onerror = (error) => {
        console.error('Web audio playback error:', error, audio.error);
        this.callbacks.onError?.(`Audio playback failed: ${audio.error?.message || 'Unknown error'}`);
      };

      audio.onabort = () => {
        console.log('Audio playback aborted');
      };

      // Set the source
      audio.src = dataUrl;
      
      // Load and play
      audio.load();
      await audio.play();
      
    } catch (error) {
      console.error('Web audio play failed:', error);
      throw error;
    }
  }

  private detectAudioFormat(base64Data: string): string {
    // Remove data URI prefix if present
    const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
    
    try {
      // Decode first few bytes to check magic numbers
      const binaryString = atob(cleanBase64.substring(0, 100));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Check for common audio format signatures
      const header = Array.from(bytes.slice(0, 12))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log('Audio header (hex):', header);

      // M4A/MP4 starts with 'ftyp'
      if (binaryString.includes('ftyp') && binaryString.includes('M4A')) {
        return 'm4a';
      }
      // WebM starts with specific signature
      if (binaryString.includes('webm')) {
        return 'webm';
      }
      // WAV starts with 'RIFF' and contains 'WAVE'
      if (binaryString.startsWith('RIFF') && binaryString.includes('WAVE')) {
        return 'wav';
      }
      // OGG starts with 'OggS'
      if (binaryString.startsWith('OggS')) {
        return 'ogg';
      }

      console.warn('Could not detect audio format, assuming m4a');
      return 'm4a';
      
    } catch (error) {
      console.error('Error detecting audio format:', error);
      return 'm4a'; // fallback
    }
  }

  private getMimeTypeFromFormat(format: string): string {
    const mimeTypes: { [key: string]: string } = {
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
      'webm': 'audio/webm',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg'
    };
    return mimeTypes[format] || 'audio/mp4';
  }

  private async saveBase64Audio(base64Data: string, format: string = 'm4a'): Promise<string> {
    if (!isReactNative) {
      // For web, return the data URL directly
      const mimeType = this.getMimeTypeFromFormat(format);
      return base64Data.startsWith('data:') 
        ? base64Data 
        : `data:${mimeType};base64,${base64Data}`;
    }

    // React Native file saving
    const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
    const extension = format.startsWith('.') ? format : `.${format}`;
    const tempUri = `${FileSystem.cacheDirectory}temp_audio_${Date.now()}${extension}`;
    
    console.log('Saving audio file:', tempUri);
    
    await FileSystem.writeAsStringAsync(tempUri, cleanBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Verify the file was written
    const fileInfo = await FileSystem.getInfoAsync(tempUri);
    console.log('Saved file info:', fileInfo);
    
    return tempUri;
  }

  // Convert base64 to ArrayBuffer for WebSocket transmission
  public base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Remove data URI prefix if present
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Convert ArrayBuffer to base64
  public arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks to prevent call stack overflow
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  // Process recorded audio file for transmission
  public async processRecordedAudio(audioUri: string): Promise<ArrayBuffer> {
    try {
      if (!isReactNative) {
        throw new Error('processRecordedAudio is only available in React Native');
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      // Read the audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert to ArrayBuffer for WebSocket transmission
      const arrayBuffer = this.base64ToArrayBuffer(base64Audio);

      // Clean up the temporary file
      await FileSystem.deleteAsync(audioUri, { idempotent: true });

      console.log('Processed audio file:', {
        originalSize: fileInfo.size,
        base64Length: base64Audio.length,
        arrayBufferSize: arrayBuffer.byteLength
      });

      return arrayBuffer;

    } catch (error) {
      console.error('Failed to process recorded audio:', error);
      throw error;
    }
  }

  // Web-specific: Process MediaRecorder blob
  public async processWebAudioBlob(blob: Blob): Promise<ArrayBuffer> {
    try {
      if (isReactNative) {
        throw new Error('processWebAudioBlob is only available in web environments');
      }

      // Convert blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      
      console.log('Processed web audio blob:', {
        blobSize: blob.size,
        blobType: blob.type,
        arrayBufferSize: arrayBuffer.byteLength
      });

      return arrayBuffer;

    } catch (error) {
      console.error('Failed to process web audio blob:', error);
      throw error;
    }
  }

  public cleanup() {
    if (this.player && isReactNative) {
      this.player.release();
      this.player = null;
    }
  }

  // Utility method to get platform info
  public getPlatformInfo() {
    return {
      isReactNative,
      isWeb: !isReactNative,
      hasAudioContext: typeof window !== 'undefined' && !!window.AudioContext,
      hasMediaRecorder: typeof window !== 'undefined' && !!window.MediaRecorder
    };
  }
}

export const audioService = AudioService.getInstance();