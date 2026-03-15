import { StyleSheet, Text, View } from "react-native";

interface CostSummaryCardsProps {
  fuelCost: string;
  maintenanceCost: string;
  costPerKm: string;
  fuelCostLabel?: string;
}

interface SummaryCardProps {
  label: string;
  value: string;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function CostSummaryCards({
  fuelCost,
  maintenanceCost,
  costPerKm,
  fuelCostLabel = "Fuel cost",
}: CostSummaryCardsProps) {
  return (
    <View style={styles.container}>
      <SummaryCard label={fuelCostLabel} value={fuelCost} />
      <SummaryCard label="Maintenance cost" value={maintenanceCost} />
      <SummaryCard label="Cost per km" value={costPerKm} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 24,
  },
  card: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
  },
});
