import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useVehicleStore } from "../store/vehicleStore";
import { validateVehicleForm } from "../domain/formValidation";

export default function AddVehicleScreen() {
  const navigation = useNavigation();
  const { createVehicle } = useVehicleStore();

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [label, setLabel] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [engine, setEngine] = useState("");
  const [powerHp, setPowerHp] = useState("");
  const [transmission, setTransmission] = useState("");
  const [mileage, setMileage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const result = validateVehicleForm({
      brand,
      model,
      year,
      label,
      fuelType,
      engine,
      powerHp,
      transmission,
      ownershipStartMileage: mileage,
      trackingStartMileage: mileage,
      currentOdometer: mileage,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await createVehicle(result.value);

    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Add vehicle</Text>
      <Text style={styles.subtitle}>
        Start with the essentials. We can layer in richer ownership data after
        the local MVP is stable.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        placeholder="Custom label (optional)"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={label}
        onChangeText={setLabel}
      />

      <TextInput
        placeholder="Brand"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={brand}
        onChangeText={setBrand}
      />

      <TextInput
        placeholder="Model"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={model}
        onChangeText={setModel}
      />

      <TextInput
        placeholder="Year"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={year}
        keyboardType="number-pad"
        onChangeText={setYear}
      />

      <TextInput
        placeholder="Fuel type (Diesel, Petrol, EV...)"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={fuelType}
        onChangeText={setFuelType}
      />

      <TextInput
        placeholder="Engine (optional)"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={engine}
        onChangeText={setEngine}
      />

      <TextInput
        placeholder="Power in hp (optional)"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={powerHp}
        keyboardType="number-pad"
        onChangeText={setPowerHp}
      />

      <TextInput
        placeholder="Transmission (optional)"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={transmission}
        onChangeText={setTransmission}
      />

      <TextInput
        placeholder="Starting odometer"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={mileage}
        keyboardType="number-pad"
        onChangeText={setMileage}
      />

      <Pressable style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Save vehicle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: "#475569",
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ee",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: "#0f172a",
  },
  error: {
    marginBottom: 12,
    color: "#b91c1c",
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 15,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
