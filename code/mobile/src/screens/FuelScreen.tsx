import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFuelStore } from "../store/fuelStore";
import { useVehicleStore } from "../store/vehicleStore";
import { formatCurrency } from "../services/vehicle/costCalculator";
import {
  getEnergyEntryLabel,
  getEnergyHistoryEmptyState,
  getEnergyHistoryTitle,
  getEnergyIntroCopy,
  getEnergyUnitLabel,
  isElectricVehicle,
} from "../services/vehicle/vehicleProfile";
import { createMileageSnapshot } from "../services/vehicle/vehicleUsage";
import { validateEnergyEntryForm } from "../domain/formValidation";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function FuelScreen() {
  const { fuelEntries, createFuelEntry, loadFuelEntries } = useFuelStore();
  const { vehicles, activeVehicleId, syncVehicleOdometer } = useVehicleStore();

  const [liters, setLiters] = useState("");
  const [price, setPrice] = useState("");
  const [odometer, setOdometer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const vehicle = vehicles.find((item) => item.id === activeVehicleId);
  const entryLabel = getEnergyEntryLabel(vehicle);
  const energyUnitLabel = getEnergyUnitLabel(vehicle);
  const mileageSnapshot = useMemo(() => {
    if (!vehicle) return null;
    return createMileageSnapshot(vehicle, fuelEntries, []);
  }, [vehicle, fuelEntries]);

  useEffect(() => {
    if (!activeVehicleId) return;
    loadFuelEntries(activeVehicleId);
  }, [activeVehicleId, loadFuelEntries]);

  const handleAddFuel = async () => {
    if (!activeVehicleId) return;
    const result = validateEnergyEntryForm({ quantity: liters, price, odometer });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    await createFuelEntry({
      vehicleId: activeVehicleId,
      date: new Date().toISOString(),
      liters: result.value.quantity,
      price: result.value.price,
      odometer: result.value.odometer,
    });
    await syncVehicleOdometer(activeVehicleId, result.value.odometer);

    setLiters("");
    setPrice("");
    setOdometer("");
  };

  const recentFuelEntries = [...fuelEntries]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{entryLabel} tracking</Text>
      <Text style={styles.subtitle}>{getEnergyIntroCopy(vehicle)}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {mileageSnapshot ? (
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotLabel}>Tracking baseline</Text>
          <Text style={styles.snapshotValue}>
            {mileageSnapshot.trackingStartMileage.toLocaleString()} km
          </Text>
          <Text style={styles.snapshotHint}>
            Ownership start:{" "}
            {mileageSnapshot.ownershipStartMileage.toLocaleString()} km
          </Text>
          <Text style={styles.snapshotHint}>
            Tracking start:{" "}
            {mileageSnapshot.trackingStartMileage.toLocaleString()} km
          </Text>
          <Text style={styles.snapshotHint}>
            Latest recorded mileage:{" "}
            {mileageSnapshot.latestRecordedMileage.toLocaleString()} km
          </Text>
        </View>
      ) : null}

      <TextInput
        placeholder={isElectricVehicle(vehicle) ? "kWh" : "Liters"}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={liters}
        keyboardType="decimal-pad"
        onChangeText={setLiters}
      />

      <TextInput
        placeholder="Price"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={price}
        keyboardType="decimal-pad"
        onChangeText={setPrice}
      />

      <TextInput
        placeholder="Odometer"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={odometer}
        keyboardType="number-pad"
        onChangeText={setOdometer}
      />

      <Pressable
        style={[styles.button, !activeVehicleId && styles.buttonDisabled]}
        disabled={!activeVehicleId}
        onPress={handleAddFuel}
      >
        <Text style={styles.buttonText}>Save {entryLabel.toLowerCase()} entry</Text>
      </Pressable>

      {!activeVehicleId ? (
        <Text style={styles.helperText}>
          Select a vehicle in Garage before adding fuel costs.
        </Text>
      ) : null}

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>{getEnergyHistoryTitle(vehicle)}</Text>
        <Text style={styles.historySubtitle}>
          Keep the habit simple: every new entry gives the dashboard more
          meaning.
        </Text>

        {recentFuelEntries.length === 0 ? (
          <Text style={styles.emptyHistory}>{getEnergyHistoryEmptyState(vehicle)}</Text>
        ) : (
          recentFuelEntries.map((entry) => (
            <View
              key={entry.id ?? `${entry.date}-${entry.odometer}`}
              style={styles.historyItem}
            >
              <View style={styles.historyCopy}>
                <Text style={styles.historyPrimary}>
                  {entry.liters.toFixed(1)} {energyUnitLabel}
                </Text>
                <Text style={styles.historyMeta}>
                  {entry.odometer.toLocaleString()} km • {formatDate(entry.date)}
                </Text>
              </View>
              <Text style={styles.historyAmount}>
                {formatCurrency(entry.price)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
    paddingBottom: 28,
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
  snapshotCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
  },
  snapshotLabel: {
    color: "#2563eb",
    fontSize: 14,
    marginBottom: 8,
  },
  snapshotValue: {
    color: "#1e3a8a",
    fontSize: 24,
    fontWeight: "700",
  },
  snapshotHint: {
    marginTop: 8,
    color: "#1d4ed8",
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
  buttonDisabled: {
    backgroundColor: "#94a3b8",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  helperText: {
    marginTop: 12,
    color: "#475569",
  },
  historyCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
  historySubtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: "#64748b",
    lineHeight: 20,
  },
  emptyHistory: {
    color: "#64748b",
    lineHeight: 22,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  historyCopy: {
    flex: 1,
    paddingRight: 16,
  },
  historyPrimary: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  historyMeta: {
    marginTop: 4,
    color: "#475569",
  },
  historyAmount: {
    color: "#0f172a",
    fontWeight: "600",
  },
});
