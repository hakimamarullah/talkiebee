import { Text } from "@react-navigation/elements";
import { StyleSheet, View, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import { WebSocketService } from "../../services/ws-service";
import { audioService, AudioService } from "../../services/audio-service";
import { 
  useAudioPlayer, 
  useAudioRecorder, 
  useAudioRecorderState,
  AudioModule,
  setAudioModeAsync, 
  RecordingOptions,
  AudioQuality,
  IOSOutputFormat
} from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";

const CROSS_PLATFORM_OPTIMIZED = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 64000,
  },
};

export function Home() {
  useKeepAwake();
  
  // Profile state
  const [user, setUser] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // disconnected, connecting, connected

  // Matching state
  const [matchingStatus, setMatchingStatus] = useState("idle"); // idle, searching, matched, no_matches
  const [matchStatus, setMatchStatus] = useState("Ready to find love!");
  const [currentPartner, setCurrentPartner] = useState(null);
  const [usersOnline, setUsersOnline] = useState(0);

  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPermissionGranted, setAudioPermissionGranted] = useState(false);

  // Refs for cleanup
  const wsServiceRef = useRef(null);
  const audioServiceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const audioPlayer = useAudioPlayer();
  const audioRecorder = useAudioRecorder(CROSS_PLATFORM_OPTIMIZED);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Load profile from secure storage
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = await SecureStore.getItemAsync("profile");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed.user || "");
        setAge(parsed.age || "");
        setCity(parsed.city || "");
        setGender(parsed.gender || "");
        setLookingFor(parsed.lookingFor || "");
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  // Setup audio permissions and mode
  useEffect(() => {
    setupAudio();
  }, []);

  const setupAudio = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setAudioPermissionGranted(status.granted);
      
      if (!status.granted) {
        Alert.alert('Permission Required', 'Microphone permission is required for voice chat');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      console.log('Audio setup completed successfully');
    } catch (error) {
      console.error('Failed to setup audio:', error);
      Alert.alert('Audio Setup Error', 'Failed to setup audio. Voice chat may not work properly.');
    }
  };

  // Setup WebSocket service and listeners
  useEffect(() => {
    setupWebSocketService();
    
    return () => {
      cleanup();
    };
  }, []);

  const setupWebSocketService = () => {
    try {
      wsServiceRef.current = WebSocketService.getInstance();
      audioServiceRef.current = AudioService.getInstance();
      
      if (audioServiceRef.current && audioPlayer) {
        audioServiceRef.current.initPlayer(audioPlayer);
        
        // Set up audio service callbacks
        audioServiceRef.current.setCallbacks({
          onPlaybackStart: () => {
            console.log('Audio playback started');
            setIsPlaying(true);
          },
          onPlaybackFinish: () => {
            console.log('Audio playback finished');
            setIsPlaying(false);
          },
          onError: (error) => {
            console.error('Audio service error:', error);
            setIsPlaying(false);
          }
        });
      }

      setupWebSocketListeners();
    } catch (error) {
      console.error('Failed to setup WebSocket service:', error);
    }
  };

  const setupWebSocketListeners = () => {
    const wsService = wsServiceRef.current;
    if (!wsService) return;

    // Remove any existing listeners to prevent duplicates
    wsService.removeAllListeners();

    // Connection events
    wsService.onConnect(() => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionStatus("connected");
      setMatchStatus("Connected! Ready to find matches");
      
      // Clear any reconnection timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    wsService.onDisconnect(() => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setConnectionStatus("disconnected");
      setMatchingStatus("idle");
      setMatchStatus("Disconnected. Tap Find Match to reconnect.");
      setCurrentPartner(null);
      setIsPlaying(false);
      
      // Attempt to reconnect after a delay if we were previously connected
      if (currentPartner || matchingStatus === "searching") {
        scheduleReconnect();
      }
    });

    // Matching events
    wsService.onMatchFound((partner) => {
      console.log('Match found:', partner);
      setMatchingStatus("matched");
      setCurrentPartner(partner);
      
      const partnerName = partner.name || "Mystery Person";
      const partnerAge = partner.age ? `, ${partner.age}` : "";
      const partnerLocation = partner.location ? ` from ${partner.location}` : "";
      
      setMatchStatus(`💕 Matched with ${partnerName}${partnerAge}${partnerLocation}!`);
    });

    wsService.onMatchEnded((reason) => {
      console.log('Match ended:', reason);
      setMatchingStatus("idle");
      setCurrentPartner(null);
      setIsPlaying(false);
      setMatchStatus(reason || "Match ended. Ready to find someone new!");
    });

    wsService.onNoMatches(() => {
      console.log('No matches available');
      setMatchingStatus("no_matches");
      setMatchStatus("No compatible matches found");
      setIsPlaying(false);
      
      // Keep searching for a bit longer
      setTimeout(() => {
        if (matchingStatus === "no_matches") {
          setMatchStatus("Still looking for matches... 🔍");
        }
      }, 3000);
    });

    wsService.onSearching?.(() => {
      console.log('Search started');
      setMatchingStatus("searching");
      setMatchStatus("Looking for your perfect match... 💕");
    });

    wsService.onStatsUpdate((stats) => {
      setUsersOnline(stats.usersOnline || 0);
    });

    wsService.onPartnerDisconnected(() => {
      console.log('Partner disconnected');
      setMatchingStatus("idle");
      setCurrentPartner(null);
      setIsPlaying(false);
      setMatchStatus("Partner disconnected. Ready to find someone new!");
    });

    wsService.onAudioReceived(async (audioData) => {
      try {
        if (audioServiceRef.current) {
          await audioServiceRef.current.playAudio(audioData);
        }
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    });

    // Handle connection errors
    wsService.onError?.((error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus("disconnected");
      setMatchStatus("Connection error. Please try again.");
    });
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) return;
    
    console.log('Scheduling reconnect in 3 seconds...');
    setMatchStatus("Connection lost. Reconnecting...");
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (!isConnected && (currentPartner || matchingStatus === "searching")) {
        console.log('Attempting to reconnect...');
        connectToServer();
      }
    }, 3000);
  };

  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsServiceRef.current) {
      wsServiceRef.current.removeAllListeners();
      wsServiceRef.current.disconnect();
    }
    
    setIsPlaying(false);
    setIsRecording(false);
  };

  // Sync recording state with recorder state
  useEffect(() => {
    setIsRecording(recorderState.isRecording);
  }, [recorderState.isRecording]);

  const validateProfile = () => {
    if (!user.trim()) {
      Alert.alert("Profile Incomplete", "Please set your name in Settings");
      return false;
    }

    const ageNum = parseInt(age);
    if (!age || ageNum < 18 || ageNum > 99) {
      Alert.alert(
        "Profile Incomplete",
        "Please set a valid age (18-99) in Settings"
      );
      return false;
    }

    if (!gender) {
      Alert.alert("Profile Incomplete", "Please select your gender in Settings");
      return false;
    }

    if (!lookingFor) {
      Alert.alert("Profile Incomplete", "Please select who you're looking for in Settings");
      return false;
    }

    return true;
  };

  const connectToServer = async () => {
    try {
      setConnectionStatus("connecting");
      setMatchStatus("Connecting to dating server...");
      
      const wsService = wsServiceRef.current;
      if (wsService) {
        await wsService.connect();
      }
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus("disconnected");
      setMatchStatus("Connection failed. Please try again.");
      throw error;
    }
  };

  const startMatching = async () => {
    if (!validateProfile()) return;
    if (!audioPermissionGranted) {
      Alert.alert("Permission Required", "Microphone permission is required for voice chat. Please enable it in Settings.");
      return;
    }

    try {
      setMatchingStatus("searching");
      
      // Connect if not already connected
      if (!isConnected) {
        await connectToServer();
      }

      const profile = {
        name: user.trim(),
        age: parseInt(age),
        gender: gender,
        lookingFor: lookingFor,
        location: city.trim() || null,
      };

      console.log('Starting match search with profile:', profile);
      
      const wsService = wsServiceRef.current;
      if (wsService) {
        await wsService.findMatch(profile);
      }
      
    } catch (error) {
      console.error('Start matching error:', error);
      setMatchingStatus("idle");
      setMatchStatus("Connection failed. Please try again.");
      Alert.alert(
        "Connection Error",
        "Failed to connect to dating server. Please check your internet connection and try again."
      );
    }
  };

  const findNextMatch = async () => {
    if (!isConnected || !validateProfile()) return;

    try {
      console.log('Finding next match...');
      setMatchingStatus("searching");
      setCurrentPartner(null);
      setMatchStatus("Looking for your next match...");

      const profile = {
        name: user.trim(),
        age: parseInt(age),
        gender: gender,
        lookingFor: lookingFor,
        location: city.trim() || null,
      };

      const wsService = wsServiceRef.current;
      if (wsService) {
        await wsService.nextMatch(profile);
      }
    } catch (error) {
      console.error('Next match error:', error);
      setMatchingStatus("idle");
      Alert.alert("Error", "Failed to find next match. Please try again.");
    }
  };

  const endSession = () => {
    console.log('Ending session...');
    
    try {
      const wsService = wsServiceRef.current;
      if (wsService) {
        wsService.disconnect();
      }
      
      setMatchingStatus("idle");
      setCurrentPartner(null);
      setMatchStatus("Ready to find love!");
      setIsPlaying(false);
      setIsRecording(false);
    } catch (error) {
      console.error('End session error:', error);
    }
  };

  const startRecording = async () => {
    if (!currentPartner || isRecording || !audioPermissionGranted) return;

    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission Required", "Microphone permission is required to record audio");
        return;
      }

      console.log('Starting audio recording...');
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error("Recording start error:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !currentPartner) return;

    try {
      console.log('Stopping audio recording...');
      await audioRecorder.stop();
      
      if (audioRecorder.uri && audioServiceRef.current) {
        try {
          console.log('Processing recorded audio...');
          const audioBuffer = await audioServiceRef.current.processRecordedAudio(audioRecorder.uri);
          
          const wsService = wsServiceRef.current;
          if (wsService && audioBuffer) {
            console.log('Sending audio data:', audioBuffer.byteLength, 'bytes');
            await wsService.sendAudio(audioBuffer);
          }
          
        } catch (conversionError) {
          console.error("Audio processing error:", conversionError);
          Alert.alert("Error", "Failed to process audio data");
        }
      }
    } catch (error) {
      console.error("Recording stop error:", error);
      Alert.alert("Error", "Failed to stop recording");
    }
  };

  const handlePTTPress = () => {
    if (!currentPartner) {
      Alert.alert("No Match", "Please find a match first before trying to talk");
      return;
    }

    if (!audioPermissionGranted) {
      Alert.alert("Permission Required", "Microphone permission is required for voice chat");
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Determine button states
  const isProfileComplete = user && age && gender && lookingFor;
  const canFindMatch = isProfileComplete && !isRecording && matchingStatus === "idle";
  const canFindNext = currentPartner && !isRecording;
  const canEndSession = isConnected && (currentPartner || matchingStatus === "searching" || matchingStatus == "no_matches");
  const canRecord = currentPartner && audioPermissionGranted && isConnected;

  return (
    <SafeAreaView style={styles.container}>
      {/* Status Display */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Status</Text>
        <Text style={styles.statusText}>{matchStatus}</Text>
        {isConnected && (
          <Text style={styles.onlineText}>👥 {usersOnline} users online</Text>
        )}
        {!isProfileComplete && (
          <Text style={styles.warningText}>⚠️ Complete your profile in Settings</Text>
        )}
      </View>

      {/* Modern Button Row */}
      <View style={styles.buttonRow}>
        {/* End Button */}
        <TouchableOpacity
          style={[
            styles.modernButton,
            styles.endButton,
            !canEndSession ? styles.modernButtonDisabled : null,
          ]}
          onPress={endSession}
          disabled={!canEndSession}
        >
          <Ionicons 
            name="stop-circle-outline" 
            size={20} 
            color={!canEndSession ? "#ccc" : "#fff"} 
          />
          <Text style={[
            styles.modernButtonText,
            !canEndSession ? styles.modernButtonTextDisabled : null
          ]}>
            End
          </Text>
        </TouchableOpacity>

        {/* Find Match Button */}
        <TouchableOpacity
          style={[
            styles.modernButton,
            styles.findButton,
            !canFindMatch ? styles.modernButtonDisabled : null,
          ]}
          onPress={startMatching}
          disabled={!canFindMatch}
        >
          <Ionicons 
            name={matchingStatus === "searching" ? "heart-outline" : "heart"} 
            size={20} 
            color={!canFindMatch ? "#ccc" : "#fff"} 
          />
          <Text style={[
            styles.modernButtonText,
            !canFindMatch ? styles.modernButtonTextDisabled : null
          ]}>
            {matchingStatus === "searching" ? "Finding..." : "Find Match"}
          </Text>
        </TouchableOpacity>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.modernButton,
            styles.nextButton,
            !canFindNext ? styles.modernButtonDisabled : null,
          ]}
          onPress={findNextMatch}
          disabled={!canFindNext}
        >
          <Ionicons 
            name="play-skip-forward-outline" 
            size={20} 
            color={!canFindNext ? "#ccc" : "#fff"} 
          />
          <Text style={[
            styles.modernButtonText,
            !canFindNext ? styles.modernButtonTextDisabled : null
          ]}>
            Next
          </Text>
        </TouchableOpacity>
      </View>

      {/* PTT Microphone Button - Bottom */}
      <View style={styles.micContainer}>
        <TouchableOpacity
          style={[
            styles.micButton,
            !canRecord ? styles.micButtonDisabled : null,
            isRecording ? styles.micButtonActive : null,
          ]}
          onPress={handlePTTPress}
          disabled={!canRecord}
        >
          <Ionicons
            name={isRecording ? "mic" : "mic-outline"}
            size={32}
            color={!canRecord ? "#ccc" : isRecording ? "#fff" : "#0066cc"}
          />
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <Ionicons name="volume-high" size={16} color="#00cc66" />
            </View>
          )}
        </TouchableOpacity>
        
        {currentPartner && (
          <Text style={styles.micHintText}>
            {isRecording ? "Release to send" : "Hold to talk"}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  statusContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 40,
    width: "100%",
    flex: 1,
    justifyContent: "flex-start",
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#222",
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  onlineText: {
    fontSize: 14,
    color: "#999",
  },
  warningText: {
    fontSize: 14,
    color: "#ff6b6b",
    marginTop: 8,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 20,
    gap: 20,
    width: "100%",
  },
  modernButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 85,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: "row",
    gap: 4,
  },
  modernButtonDisabled: {
    backgroundColor: "#f5f5f5",
    shadowOpacity: 0.05,
  },
  endButton: {
    backgroundColor: "#ff6b6b",
  },
  findButton: {
    backgroundColor: "#51cf66",
  },
  nextButton: {
    backgroundColor: "#339af0",
  },
  modernButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  modernButtonTextDisabled: {
    color: "#ccc",
  },
  micContainer: {
    alignItems: "center",
    paddingBottom: 40,
  },
  micButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0066cc",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    position: "relative",
  },
  micButtonDisabled: {
    borderColor: "#e0e0e0",
    backgroundColor: "#f5f5f5",
  },
  micButtonActive: {
    backgroundColor: "#ff4444",
    borderColor: "#ff4444",
  },
  micHintText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
  playingIndicator: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});