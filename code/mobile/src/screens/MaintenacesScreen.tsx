import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMaintenanceStore } from "../store/maintenanceStore";
import { useVehicleStore } from "../store/vehicleStore";
import { formatCurrency } from "../services/costCalculator";
import { createMileageSnapshot } from "../services/vehicleUsage";
import { validateMaintenanceEntryForm } from "../domain/formValidation";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MaintenanceScreen() {
  const { maintenanceEntries, createMaintenanceEntry, loadMaintenanceEntries } =
    useMaintenanceStore();
  const { vehicles, activeVehicleId, syncVehicleOdometer } = useVehicleStore();

  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [odometer, setOdometer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const vehicle = vehicles.find((item) => item.id === activeVehicleId);
  const mileageSnapshot = useMemo(() => {
    if (!vehicle) return null;
    return createMileageSnapshot(vehicle, [], maintenanceEntries);
  }, [vehicle, maintenanceEntries]);

  useEffect(() => {
    if (!activeVehicleId) return;
    loadMaintenanceEntries(activeVehicleId);
  }, [activeVehicleId, loadMaintenanceEntries]);

  const handleSubmit = async () => {
    if (!activeVehicleId) return;
    const result = validateMaintenanceEntryForm({ type, cost, odometer });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    await createMaintenanceEntry({
      vehicleId: activeVehicleId,
      type: result.value.type,
      description,
      cost: result.value.cost,
      date: new Date().toISOString(),
      odometer: result.value.odometer,
    });
    await syncVehicleOdometer(activeVehicleId, result.value.odometer);

    setType("");
    setDescription("");
    setCost("");
    setOdometer("");
  };

  const recentMaintenanceEntries = [...maintenanceEntries]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Maintenance</Text>
      <Text style={styles.subtitle}>
        Build your service history for repairs, oil changes, tires, and every
        other ownership cost.
      </Text>

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
        placeholder="Type"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={type}
        onChangeText={setType}
      />

      <TextInput
        placeholder="Description"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={description}
        onChangeText={setDescription}
      />

      <TextInput
        placeholder="Cost"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={cost}
        keyboardType="decimal-pad"
        onChangeText={setCost}
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
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>Save maintenance entry</Text>
      </Pressable>

      {!activeVehicleId ? (
        <Text style={styles.helperText}>
          Select a vehicle in Garage before logging maintenance.
        </Text>
      ) : null}

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Recent maintenance</Text>
        <Text style={styles.historySubtitle}>
          Repairs and regular service stay visible in one local timeline.
        </Text>

        {recentMaintenanceEntries.length === 0 ? (
          <Text style={styles.emptyHistory}>
            No maintenance entries yet. Your saved services will show up here.
          </Text>
        ) : (
          recentMaintenanceEntries.map((entry) => (
            <View
              key={entry.id ?? `${entry.date}-${entry.odometer}`}
              style={styles.historyItem}
            >
              <View style={styles.historyCopy}>
                <Text style={styles.historyPrimary}>
                  {entry.type || "Maintenance"}
                </Text>
                <Text style={styles.historyMeta}>
                  {entry.description || "Service entry"}
                </Text>
                <Text style={styles.historyMeta}>
                  {entry.odometer.toLocaleString()} km • {formatDate(entry.date)}
                </Text>
              </View>
              <Text style={styles.historyAmount}>
                {formatCurrency(entry.cost)}
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
    backgroundColor: "#fef3c7",
  },
  snapshotLabel: {
    color: "#b45309",
    fontSize: 14,
    marginBottom: 8,
  },
  snapshotValue: {
    color: "#92400e",
    fontSize: 24,
    fontWeight: "700",
  },
  snapshotHint: {
    marginTop: 8,
    color: "#b45309",
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
    lineHeight: 20,
  },
  historyAmount: {
    color: "#0f172a",
    fontWeight: "600",
  },
});
