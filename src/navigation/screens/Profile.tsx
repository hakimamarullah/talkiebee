import { Picker } from "@react-native-picker/picker";
import { StaticScreenProps } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { WebSocketService } from "../../services/ws-service";

type Props = StaticScreenProps<{ user: string }>;

export function Profile() {
  const [user, setUser] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  const ageRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);

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

  const saveProfile = async () => {
    const profileData = { user, age, city, gender, lookingFor };
    await SecureStore.setItemAsync("profile", JSON.stringify(profileData));
    alert("Profile saved!");
    WebSocketService.getInstance().disconnect();
    await Updates.reloadAsync();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Name */}
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={user}
          onChangeText={setUser}
          placeholder="Enter name"
          placeholderTextColor="#888"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => ageRef.current?.focus()}
        />
      </View>

      {/* Age */}
      <View style={styles.field}>
        <Text style={styles.label}>Age</Text>
        <TextInput
          ref={ageRef}
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="Enter age"
          placeholderTextColor="#888"
          keyboardType="numeric"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => cityRef.current?.focus()}
        />
      </View>

      {/* City */}
      <View style={styles.field}>
        <Text style={styles.label}>City</Text>
        <TextInput
          ref={cityRef}
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Enter city"
          placeholderTextColor="#888"
          returnKeyType="done"
        />
      </View>

      {/* Gender */}
      <View style={styles.field}>
        <Text style={styles.label}>Gender</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={gender}
            onValueChange={(itemValue) => setGender(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select gender" value="" />
            <Picker.Item label="Male" value="male" />
            <Picker.Item label="Female" value="female" />
          </Picker>
        </View>
      </View>

      {/* Looking For */}
      <View style={styles.field}>
        <Text style={styles.label}>Looking For</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={lookingFor}
            onValueChange={(itemValue) => setLookingFor(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select preference" value="" />
            <Picker.Item label="Male" value="male" />
            <Picker.Item label="Female" value="female" />
            <Picker.Item label="Both" value="both" />
          </Picker>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#f8f8f8",
  },
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: "#444",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    color: "#000", // Always black text
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    color: "#000",
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: "#FFCB00", // Bumble Yellow
    paddingVertical: 14,
    borderRadius: 50, // pill shape
    alignItems: "center",
  },
  saveButtonText: {
    color: "#000", // Black text for Bumble style
    fontSize: 16,
    fontWeight: "bold",
  },
});
