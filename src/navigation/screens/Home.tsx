import { Text } from "@react-navigation/elements";
import { StyleSheet, View, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
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

const CROSS_PLATFORM_OPTIMIZED: RecordingOptions = {
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
    mimeType: 'audio/webm;codecs=opus', // Opus has better web support
    bitsPerSecond: 64000,
  },
};

export function Home() {
  const [user, setUser] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  // Matching state
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [matchStatus, setMatchStatus] = useState("Ready to find love!");
  const [currentPartner, setCurrentPartner] = useState(null);
  const [usersOnline, setUsersOnline] = useState(0);

  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioPlayer = useAudioPlayer();
  const audioRecorder = useAudioRecorder(CROSS_PLATFORM_OPTIMIZED);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Load profile from secure storage
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync("profile");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed.user || "");
        setAge(parsed.age || "");
        setCity(parsed.city || "");
        setGender(parsed.gender || "");
        setLookingFor(parsed.lookingFor || "");
      }
    })();
  }, []);

  // Setup audio permissions and mode
  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert('Permission Required', 'Microphone permission is required for voice chat');
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
      } catch (error) {
        console.error('Failed to setup audio:', error);
      }
    })();
  }, []);

  // Setup WebSocket event listeners
  useEffect(() => {
    const wsService = WebSocketService.getInstance();
    const audioService = AudioService.getInstance();
    audioService.initPlayer(audioPlayer);

    // Set up audio service callbacks
    audioService.setCallbacks({
      onPlaybackStart: () => setIsPlaying(true),
      onPlaybackFinish: () => setIsPlaying(false),
      onError: (error) => {
        console.error('Audio service error:', error);
        setIsPlaying(false);
      }
    });

    // Connection events
    wsService.onConnect(() => {
      setIsConnected(true);
      setMatchStatus("Connected! Looking for matches...");
    });

    wsService.onDisconnect(() => {
      setIsConnected(false);
      setIsMatching(false);
      setIsPlaying(false);
      setMatchStatus("Disconnected");
      setCurrentPartner(null);
    });

    // Matching events
    wsService.onMatchFound((partner) => {
      setIsMatching(false);
      setCurrentPartner(partner);
      const partnerName = partner.name || "Mystery Person";
      const partnerAge = partner.age ? `, ${partner.age}` : "";
      const partnerLocation = partner.location
        ? ` from ${partner.location}`
        : "";
      setMatchStatus(
        `💕 Matched with ${partnerName}${partnerAge}${partnerLocation}!`
      );
    });

    wsService.onMatchEnded((reason) => {
      setCurrentPartner(null);
      setIsPlaying(false);
      setMatchStatus(reason || "Match ended. Ready to find someone new!");
    });

    wsService.onNoMatches(() => {
      setMatchStatus("No matches available. Please Try Again");
      setIsPlaying(false);
      setCurrentPartner(null)
    });

    wsService.onStatsUpdate((stats) => {
      setUsersOnline(stats.usersOnline || 0);
    });

    wsService.onPartnerDisconnected(() => {
      setCurrentPartner(null);
      setIsPlaying(false);
      setMatchStatus("Partner disconnected. Ready to find someone new!");
    });

    wsService.onAudioReceived(async (base64Audio) => {
      try {
        await audioService.playAudio(base64Audio);
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    });

    return () => {
      wsService.removeAllListeners();
    };
  }, [isConnected, currentPartner, audioPlayer]);

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
      Alert.alert(
        "Profile Incomplete",
        "Please select your gender in Settings"
      );
      return false;
    }

    if (!lookingFor) {
      Alert.alert(
        "Profile Incomplete",
        "Please select who you're looking for in Settings"
      );
      return false;
    }

    return true;
  };

  const startMatching = async () => {
    if (!validateProfile()) return;

    try {
      setIsMatching(true);
      setMatchStatus("Connecting to dating server...");

      const profile = {
        name: user.trim(),
        age: parseInt(age),
        gender: gender,
        lookingFor: lookingFor,
        location: city.trim() || null,
      };

      const wsService = WebSocketService.getInstance();
      await wsService.connect();
      await wsService.findMatch(profile);
    } catch (error) {
      setIsMatching(false);
      setMatchStatus("Connection failed. Please try again.");
      Alert.alert(
        "Connection Error",
        "Failed to connect to dating server. Please check your internet connection and try again."
      );
    }
  };

  const findNextMatch = async () => {
    if (!isConnected) return;

    try {
      setCurrentPartner(null);
      setMatchStatus("Looking for your next match...");

      const profile = {
        name: user.trim(),
        age: parseInt(age),
        gender: gender,
        lookingFor: lookingFor,
        location: city.trim() || null,
      };

      const wsService = WebSocketService.getInstance();
      await wsService.findMatch(profile);
    } catch (error) {
      Alert.alert("Error", "Failed to find next match. Please try again.");
    }
  };

  const endSession = () => {
    const wsService = WebSocketService.getInstance();
    wsService.disconnect();
    setCurrentPartner(null);
    setMatchStatus("Ready to find love!");
  };

  const startRecording = async () => {
    if (!currentPartner || isRecording) return;

    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission Required", "Microphone permission is required to record audio");
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error("Recording start error:", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

 const stopRecording = async () => {
  if (!isRecording) return;

  try {
    await audioRecorder.stop();
    
    if (audioRecorder.uri) {
      try {
        // Process the recorded audio and convert to ArrayBuffer
        const audioBuffer = await audioService.processRecordedAudio(audioRecorder.uri);
        
        // Send the ArrayBuffer directly via WebSocket
        const wsService = WebSocketService.getInstance();
        await wsService.sendAudio(audioBuffer);
        
        console.log('Audio sent successfully');
        
      } catch (conversionError) {
        console.error("Audio processing error:", conversionError);
        Alert.alert("Error", "Failed to process audio data");
      }
    }
  } catch (error) {
    console.error("Recording error:", error);
    Alert.alert("Error", "Failed to stop recording");
  } finally {
    setIsRecording(false);
  }
};

  const handlePTTPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Status Display */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Status</Text>
        <Text style={styles.statusText}>{matchStatus}</Text>
        {isConnected && (
          <Text style={styles.onlineText}>👥 {usersOnline} users online</Text>
        )}
      </View>

      {/* Modern Button Row */}
      <View style={styles.buttonRow}>
        {/* End Button */}
        <TouchableOpacity
          style={[
            styles.modernButton,
            styles.endButton,
            !currentPartner ? styles.modernButtonDisabled : null,
          ]}
          onPress={endSession}
          disabled={Boolean(!currentPartner)}
        >
          <Ionicons name="stop-circle-outline" size={20} color={!currentPartner ? "#ccc" : "#fff"} />
          <Text style={[
            styles.modernButtonText,
            !currentPartner ? styles.modernButtonTextDisabled : null
          ]}>
            End
          </Text>
        </TouchableOpacity>

        {/* Find Match Button */}
        <TouchableOpacity
          style={[
            styles.modernButton,
            styles.findButton,
            (isMatching || currentPartner || !user || !age || !gender || !lookingFor) ? styles.modernButtonDisabled : null,
          ]}
          onPress={startMatching}
          disabled={Boolean(isMatching || currentPartner || !user || !age || !gender || !lookingFor)}
        >
          <Ionicons 
            name={isMatching ? "heart-outline" : "heart"} 
            size={20} 
            color={(isMatching || currentPartner || !user || !age || !gender || !lookingFor) ? "#ccc" : "#fff"} 
          />
          <Text style={[
            styles.modernButtonText,
            (isMatching || currentPartner || !user || !age || !gender || !lookingFor) ? styles.modernButtonTextDisabled : null
          ]}>
            {isMatching ? "Finding..." : "Find Match"}
          </Text>
        </TouchableOpacity>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.modernButton,
            styles.nextButton,
            !currentPartner ? styles.modernButtonDisabled : null,
          ]}
          onPress={findNextMatch}
          disabled={Boolean(!currentPartner)}
        >
          <Ionicons name="play-skip-forward-outline" size={20} color={!currentPartner ? "#ccc" : "#fff"} />
          <Text style={[
            styles.modernButtonText,
            !currentPartner ? styles.modernButtonTextDisabled : null
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
            !currentPartner ? styles.micButtonDisabled : null,
            isRecording ? styles.micButtonActive : null,
          ]}
          onPress={handlePTTPress}
          disabled={Boolean(!currentPartner)}
        >
          <Ionicons
            name={isRecording ? "mic" : "mic-outline"}
            size={32}
            color={!currentPartner ? "#ccc" : isRecording ? "#fff" : "#0066cc"}
          />
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <Ionicons name="volume-high" size={16} color="#00cc66" />
            </View>
          )}
        </TouchableOpacity>
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
  },
  onlineText: {
    fontSize: 14,
    color: "#999",
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