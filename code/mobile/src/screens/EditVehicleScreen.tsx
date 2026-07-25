import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useVehicleStore } from "../store/vehicleStore";
import { validateVehicleForm } from "../domain/formValidation";

export default function EditVehicleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { vehicles, saveVehicle } = useVehicleStore();

  const vehicleId =
    typeof (route.params as { vehicleId?: number } | undefined)?.vehicleId ===
    "number"
      ? (route.params as { vehicleId: number }).vehicleId
      : null;

  const vehicle = useMemo(
    () => vehicles.find((item) => item.id === vehicleId),
    [vehicleId, vehicles],
  );

  const [brand, setBrand] = useState(vehicle?.brand ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [year, setYear] = useState(vehicle ? String(vehicle.year) : "");
  const [label, setLabel] = useState(vehicle?.label ?? "");
  const [fuelType, setFuelType] = useState(vehicle?.fuelType ?? "");
  const [engine, setEngine] = useState(vehicle?.engine ?? "");
  const [powerHp, setPowerHp] = useState(
    vehicle?.powerHp ? String(vehicle.powerHp) : "",
  );
  const [transmission, setTransmission] = useState(
    vehicle?.transmission ?? "",
  );
  const [ownershipStartMileage, setOwnershipStartMileage] = useState(
    vehicle ? String(vehicle.ownershipStartMileage) : "",
  );
  const [trackingStartMileage, setTrackingStartMileage] = useState(
    vehicle ? String(vehicle.trackingStartMileage) : "",
  );
  const [currentOdometer, setCurrentOdometer] = useState(
    vehicle ? String(vehicle.currentOdometer) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!vehicle?.id) return;

    const result = validateVehicleForm({
      brand,
      model,
      year,
      label,
      fuelType,
      engine,
      powerHp,
      transmission,
      ownershipStartMileage,
      trackingStartMileage,
      currentOdometer,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await saveVehicle({
      id: vehicle.id,
      clientId: vehicle.clientId,
      ...result.value,
    });

    navigation.goBack();
  };

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Vehicle not found</Text>
        <Text style={styles.subtitle}>
          Go back to Garage and choose a car to edit.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Edit vehicle</Text>
      <Text style={styles.subtitle}>
        Adjust ownership start, tracking baseline, and current odometer
        separately. This is also where the first layer of domain details lives.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        placeholder="Custom label"
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
        placeholder="Fuel type"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={fuelType}
        onChangeText={setFuelType}
      />

      <TextInput
        placeholder="Engine"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={engine}
        onChangeText={setEngine}
      />

      <TextInput
        placeholder="Power in hp"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={powerHp}
        keyboardType="number-pad"
        onChangeText={setPowerHp}
      />

      <TextInput
        placeholder="Transmission"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={transmission}
        onChangeText={setTransmission}
      />

      <TextInput
        placeholder="Ownership start mileage"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={ownershipStartMileage}
        keyboardType="number-pad"
        onChangeText={setOwnershipStartMileage}
      />

      <TextInput
        placeholder="Tracking start mileage"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={trackingStartMileage}
        keyboardType="number-pad"
        onChangeText={setTrackingStartMileage}
      />

      <TextInput
        placeholder="Current odometer"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={currentOdometer}
        keyboardType="number-pad"
        onChangeText={setCurrentOdometer}
      />

      <Pressable style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Save changes</Text>
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
