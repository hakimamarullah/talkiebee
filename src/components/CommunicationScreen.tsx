import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  AppState,
  AppStateStatus,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingOptions,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as SecureStore from "expo-secure-store";
import { webSocketService } from "../services/buzz-service";
import { audioService } from "../services/audio-service";

const CROSS_PLATFORM_OPTIMIZED: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: "mpeg4",
    audioEncoder: "aac",
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm;codecs=opus",
    bitsPerSecond: 64000,
  },
};

const { width } = Dimensions.get("window");

interface CommunicationScreenProps {
  serverUrl: string;
  onLeave: () => void;
}

export function CommunicationScreen({
  serverUrl,
  onLeave,
}: CommunicationScreenProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const audioPlayer = useAudioPlayer();
  const audioRecorder = useAudioRecorder(CROSS_PLATFORM_OPTIMIZED);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Use refs to track component mount state and prevent memory leaks
  const isMountedRef = useRef(true);
  const hasSetupServicesRef = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized callback functions to prevent unnecessary re-renders
  const handleWebSocketConnect = useCallback(() => {
    if (!isMountedRef.current) return;
    console.log("WebSocket connected");
    setIsConnected(true);
    setConnectionError(null);
  }, []);

  const handleWebSocketDisconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    console.log("WebSocket disconnected");
    setIsConnected(false);
    setOnlineCount(0);
  }, []);

  const handleUserCountUpdate = useCallback((count: number) => {
    if (!isMountedRef.current) return;
    console.log("User count updated:", count);
    setOnlineCount(count);
  }, []);

  const handleAudioReceived = useCallback((audioData: ArrayBuffer) => {
    if (!isMountedRef.current) return;
    console.log("Audio received", "size:", audioData.byteLength);
    try {
      const base64Audio = audioService.arrayBufferToBase64(audioData);
      audioService.playAudio(base64Audio);
    } catch (error) {
      console.error("Error playing received audio:", error);
    }
  }, []);

  const handleWebSocketError = useCallback((error: string) => {
    if (!isMountedRef.current) return;
    console.error("WebSocket error:", error);
    setConnectionError(error);
  }, []);

  const handleMaxRetryExceeded = useCallback((counter: number) => {
    if (!isMountedRef.current) return;
    console.log(`Max Retry Exceeded: ${counter}`);
    Alert.alert('Connection Failed', 'Maximum retry attempts exceeded. Please try again later.');
  }, []);

  // Setup services only once
  const setupServices = useCallback(async () => {
    if (hasSetupServicesRef.current || !isMountedRef.current) return;
    hasSetupServicesRef.current = true;

    try {
      // Set up WebSocket callbacks
      webSocketService.setCallbacks({
        onConnect: handleWebSocketConnect,
        onDisconnect: handleWebSocketDisconnect,
        onUserCountUpdate: handleUserCountUpdate,
        onAudioReceived: handleAudioReceived,
        onError: handleWebSocketError,
        onMaxRetryExceeded: handleMaxRetryExceeded,
      });

      // Set up audio service callbacks
      audioService.setCallbacks({
        onRecordingStart: () => console.log("Recording started"),
        onRecordingStop: () => console.log("Recording stopped"),
        onPlaybackStart: () => console.log("Playback started"),
        onPlaybackFinish: () => console.log("Playback finished"),
        onError: (error) => {
          console.error("Audio error:", error);
          if (isMountedRef.current) {
            Alert.alert("Audio Error", error);
          }
        },
      });

      audioService.initPlayer(audioPlayer);
    } catch (error) {
      console.error("Failed to setup services:", error);
      if (isMountedRef.current) {
        Alert.alert("Setup Error", "Failed to initialize audio services");
      }
    }
  }, [
    handleWebSocketConnect,
    handleWebSocketDisconnect,
    handleUserCountUpdate,
    handleAudioReceived,
    handleWebSocketError,
    handleMaxRetryExceeded,
    audioPlayer
  ]);

  const connectToServer = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      // Clear any existing connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      // Set a timeout for connection attempt
      connectionTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !isConnected) {
          setConnectionError("Connection timeout");
        }
      }, 10000); // 10 second timeout

      await webSocketService.connect(serverUrl);
    } catch (error) {
      console.error("Failed to connect to server:", error);
      if (isMountedRef.current) {
        setConnectionError("Failed to connect to relay server");
      }
    }
  }, [serverUrl, isConnected]);

  const cleanup = useCallback(() => {
    console.log("Cleaning up CommunicationScreen");
    isMountedRef.current = false;

    // Clear connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // Stop any ongoing recording
    if (isRecording && audioRecorder) {
      audioRecorder.stop().catch(console.error);
    }

    // Stop reconnection attempts before disconnecting
    webSocketService.stopReconnecting();
    webSocketService.disconnect();
    audioService.cleanup();
  }, [isRecording, audioRecorder]);

  // Handle app state changes to manage connections properly
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      webSocketService.stopReconnecting();
    } else if (nextAppState === 'active' && isMountedRef.current && !isConnected) {
      connectToServer();
    }
  }, [isConnected, connectToServer]);

  useEffect(() => {
    isMountedRef.current = true;
    setupServices();
    connectToServer();

    // Add app state listener
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      console.log("CommunicationScreen unmounting");
      cleanup();
      appStateSubscription.remove();
    };
  }, []); // Empty dependency array - this should only run once

  // Separate effect for recording state updates
  useEffect(() => {
    if (isMountedRef.current) {
      setIsRecording(recorderState.isRecording);
    }
  }, [recorderState.isRecording]);

  const handleLeave = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync("relay_server_url");
    } catch (error) {
      console.error("Error deleting relay server URL:", error);
    }
    
    cleanup();
    onLeave();
  }, [cleanup, onLeave]);

  const startRecording = useCallback(async () => {
    if (isRecording || !isMountedRef.current) return;

    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Microphone permission is required to record audio"
        );
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error("Recording start error:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Failed to start recording");
      }
    }
  }, [isRecording, audioRecorder]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !isMountedRef.current) return;

    try {
      await audioRecorder.stop();

      if (audioRecorder.uri && webSocketService.isConnected()) {
        try {
          const audioBuffer = await audioService.processRecordedAudio(
            audioRecorder.uri
          );

          webSocketService.sendAudio(audioBuffer);
          console.log("Audio sent successfully");
        } catch (conversionError) {
          console.error("Audio processing error:", conversionError);
          if (isMountedRef.current) {
            Alert.alert("Error", "Failed to process audio data");
          }
        }
      }
    } catch (error) {
      console.error("Recording error:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Failed to stop recording");
      }
    }
  }, [isRecording, audioRecorder]);

  // Early return if component is unmounted
  if (!isMountedRef.current) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
          <Ionicons name="arrow-back" size={24} color="white" />
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>

        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? "#48f542" : "#ff0000" },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? "Connected" : connectionError || "Disconnected"}
          </Text>
        </View>
      </View>

      <View style={styles.centerContent}>
        <View style={styles.onlineCounter}>
          <Ionicons name="people" size={32} color="#F5C842" />
          <Text style={styles.onlineCount}>{onlineCount}</Text>
          <Text style={styles.onlineLabel}>Users Online</Text>
        </View>

        {/* Debug info */}
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Audio: {audioService.getPlatformInfo().isReactNative ? "RN" : "Web"}
          </Text>
          <Text style={styles.debugText}>
            WS: {webSocketService.getConnectionInfo().readyState}
          </Text>
          <Text style={styles.debugText}>
            Retry: {webSocketService.getConnectionInfo().reconnectAttempts}
          </Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[
            styles.pttButton,
            {
              backgroundColor: isRecording
                ? "#ff4444"
                : isConnected
                ? "#F5C842"
                : "#666666",
              opacity: isConnected ? 1 : 0.5,
            },
          ]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={!isConnected}
        >
          <Ionicons
            name={isRecording ? "mic" : "mic-outline"}
            size={48}
            color="white"
          />
          <Text style={styles.pttText}>
            {!isConnected
              ? "Connecting..."
              : isRecording
              ? "Recording..."
              : "Hold to Talk"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#2a2a2a",
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  leaveText: {
    color: "white",
    fontSize: 16,
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: "white",
    fontSize: 14,
    maxWidth: 120,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  onlineCounter: {
    alignItems: "center",
  },
  onlineCount: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#F5C842",
    marginTop: 10,
  },
  onlineLabel: {
    fontSize: 16,
    color: "#888",
    marginTop: 5,
  },
  debugInfo: {
    marginTop: 30,
    alignItems: "center",
  },
  debugText: {
    fontSize: 12,
    color: "#666",
    marginVertical: 2,
  },
  bottomSection: {
    paddingBottom: 50,
    alignItems: "center",
  },
  pttButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pttText: {
    color: "white",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
});