import { Picker } from "@react-native-picker/picker";
import { StaticScreenProps } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = StaticScreenProps<{
  user: string;
}>;

export function Profile() {
  const [user, setUser] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  // refs for moving focus
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={user}
          onChangeText={setUser}
          placeholder="Enter name"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => ageRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Age</Text>
        <TextInput
          ref={ageRef}
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="Enter age"
          keyboardType="numeric"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => cityRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>City</Text>
        <TextInput
          ref={cityRef}
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Enter city"
          returnKeyType="done"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Gender</Text>
        <Picker
          selectedValue={gender}
          onValueChange={(itemValue) => setGender(itemValue)}
        >
          <Picker.Item label="Select gender" value="" />
          <Picker.Item label="Male" value="male" />
          <Picker.Item label="Female" value="female" />
        </Picker>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Looking For</Text>
        <Picker
          selectedValue={lookingFor}
          onValueChange={(itemValue) => setLookingFor(itemValue)}
        >
          <Picker.Item label="Select preference" value="" />
          <Picker.Item label="Male" value="male" />
          <Picker.Item label="Female" value="female" />
          <Picker.Item label="Both" value="both" />
        </Picker>
      </View>

      <Button title="Save" onPress={saveProfile} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
  },
});
