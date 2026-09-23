import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChargingStore } from '../store/chargingStore';
import { useExpenseStore } from '../store/expenseStore';
import { useFuelStore } from '../store/fuelStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useVehicleStore } from '../store/vehicleStore';
import { formatCurrency } from '../services/vehicle/costCalculator';
import { buildVehicleHistory } from '../services/vehicle/vehicleHistory';
import { getActiveVehicle } from '../services/vehicle/activeVehicle';
import { colors, control, space } from '../shared/ui/tokens';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HistoryScreen() {
    const { vehicles, activeVehicleId } = useVehicleStore();
    const { fuelEntries, loadFuelEntries } = useFuelStore();
    const { chargingEntries, loadChargingEntries } = useChargingStore();
    const { maintenanceEntries, loadMaintenanceEntries } = useMaintenanceStore();
    const { expenseEntries, loadExpenseEntries } = useExpenseStore();
    const vehicle = getActiveVehicle(vehicles, activeVehicleId);

    useEffect(() => {
        if (!activeVehicleId) return;
        void Promise.all([
            loadFuelEntries(activeVehicleId),
            loadChargingEntries(activeVehicleId),
            loadMaintenanceEntries(activeVehicleId),
            loadExpenseEntries(activeVehicleId),
        ]);
    }, [activeVehicleId, loadChargingEntries, loadExpenseEntries, loadFuelEntries, loadMaintenanceEntries]);

    if (!vehicle || activeVehicleId === null) {
        return (
            <SafeAreaView edges={['top']} style={styles.emptyState}>
                <Text style={styles.title}>No active vehicle yet</Text>
                <Text style={styles.copy}>Choose or add a vehicle in Garage to see its recorded history.</Text>
            </SafeAreaView>
        );
    }

    const history = buildVehicleHistory(
        vehicle,
        fuelEntries.filter((entry) => entry.vehicleId === activeVehicleId),
        maintenanceEntries.filter((entry) => entry.vehicleId === activeVehicleId),
        chargingEntries.filter((entry) => entry.vehicleId === activeVehicleId),
        expenseEntries.filter((entry) => entry.vehicleId === activeVehicleId),
    );

    return (
        <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>History</Text>
            <Text style={styles.copy}>{vehicle.label || `${vehicle.brand} ${vehicle.model}`} · newest first</Text>
            {history.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No recorded events yet</Text>
                    <Text style={styles.copy}>Use Add to record a fill-up, charge, maintenance, or ownership expense.</Text>
                </View>
            ) : history.map((event) => (
                <View key={event.id} style={styles.item}>
                    <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>{event.title}</Text>
                        <Text style={styles.copy}>{event.detail}</Text>
                        <Text style={styles.date}>{formatDate(event.date)}</Text>
                    </View>
                    <Text style={styles.amount}>{formatCurrency(event.amount)}</Text>
                </View>
            ))}
        </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: space.page, paddingBottom: control.pageBottom },
    emptyState: { flex: 1, justifyContent: 'center', padding: space.page, backgroundColor: colors.background },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    copy: { marginTop: 6, color: colors.secondaryText, lineHeight: 21 },
    emptyCard: { marginTop: space.section, paddingTop: space.section, borderTopWidth: 1, borderTopColor: colors.border },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    itemCopy: { flex: 1, paddingRight: space.md },
    itemTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    date: { marginTop: 6, color: '#94a3b8', fontSize: 13 },
    amount: { color: colors.text, fontWeight: '700' },
});
