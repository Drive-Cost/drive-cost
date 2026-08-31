import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import CostSummaryCards from '../components/CostSummaryCards';
import SyncStatusCard from '../components/SyncStatusCard';
import { useFuelStore } from '../store/fuelStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useVehicleStore } from '../store/vehicleStore';
import { useSyncStore } from '../store/syncStore';
import { syncDevice } from '../services/sync/syncService';
import {
    calculateCostPerKm,
    calculateTotalFuelCost,
    calculateTotalMaintenanceCost,
    formatCostPerKm,
    formatCurrency,
} from '../services/vehicle/costCalculator';
import { getEnergyCostLabel, getEnergyEventTitle, isElectricVehicle } from '../services/vehicle/vehicleProfile';
import { buildVehicleInsights } from '../services/vehicle/vehicleInsights';
import { createMileageSnapshot } from '../services/vehicle/vehicleUsage';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardScreen() {
    const { vehicles, activeVehicleId } = useVehicleStore();
    const { fuelEntries, loadFuelEntries } = useFuelStore();
    const { maintenanceEntries, loadMaintenanceEntries } = useMaintenanceStore();
    const syncStatus = useSyncStore();

    const vehicle = vehicles.find((item) => item.id === activeVehicleId);

    useEffect(() => {
        if (!activeVehicleId) return;

        loadFuelEntries(activeVehicleId);
        loadMaintenanceEntries(activeVehicleId);
    }, [activeVehicleId, loadFuelEntries, loadMaintenanceEntries]);

    if (!vehicle) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No active vehicle yet</Text>
                <Text style={styles.emptyText}>
                    Add your first car in Garage to start tracking fuel, maintenance, and cost per kilometer.
                </Text>
            </View>
        );
    }

    const totalFuelCost = calculateTotalFuelCost(fuelEntries);
    const totalMaintenanceCost = calculateTotalMaintenanceCost(maintenanceEntries);
    const totalCost = totalFuelCost + totalMaintenanceCost;
    const mileageSnapshot = createMileageSnapshot(vehicle, fuelEntries, maintenanceEntries);
    const costPerKm = calculateCostPerKm(totalCost, mileageSnapshot.trackedDistance);
    const recentEvents = [
        ...fuelEntries.map((entry) => ({
            id: `fuel-${entry.id ?? entry.date}`,
            title: getEnergyEventTitle(vehicle),
            amount: formatCurrency(entry.price),
            meta: `${entry.liters.toFixed(1)} ${
                isElectricVehicle(vehicle) ? 'kWh' : 'L'
            } • ${entry.odometer.toLocaleString()} km`,
            date: entry.date,
        })),
        ...maintenanceEntries.map((entry) => ({
            id: `maintenance-${entry.id ?? entry.date}`,
            title: entry.type || 'Maintenance',
            amount: formatCurrency(entry.cost),
            meta: `${entry.description || 'Service entry'} • ${entry.odometer.toLocaleString()} km`,
            date: entry.date,
        })),
    ]
        .sort((left, right) => right.date.localeCompare(left.date))
        .slice(0, 4);
    const insights = buildVehicleInsights(
        vehicle,
        fuelEntries,
        maintenanceEntries,
        mileageSnapshot.trackedDistance,
        totalFuelCost,
        totalMaintenanceCost,
    );

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
                <Text style={styles.eyebrow}>Active vehicle</Text>
                <Text style={styles.title}>
                    {vehicle.brand} {vehicle.model}
                </Text>
                <Text style={styles.subtitle}>
                    {vehicle.year} • Current odometer {vehicle.currentOdometer.toLocaleString()} km
                </Text>
                <Text style={styles.subtitle}>
                    Tracking starts at {mileageSnapshot.trackingStartMileage.toLocaleString()} km
                </Text>
            </View>

            <SyncStatusCard
                status={syncStatus}
                onRetry={() => {
                    void syncDevice().catch(() => undefined);
                }}
            />

            <Text style={styles.sectionTitle}>Cost overview</Text>

            <CostSummaryCards
                fuelCost={formatCurrency(totalFuelCost)}
                maintenanceCost={formatCurrency(totalMaintenanceCost)}
                costPerKm={formatCostPerKm(costPerKm)}
                fuelCostLabel={getEnergyCostLabel(vehicle)}
            />

            <View style={styles.insightCard}>
                <Text style={styles.insightLabel}>Tracking distance model</Text>
                <Text style={styles.insightValue}>{mileageSnapshot.trackedDistance.toLocaleString()} km</Text>
                <Text style={styles.insightFootnote}>
                    Ownership start: {mileageSnapshot.ownershipStartMileage.toLocaleString()} km
                </Text>
                <Text style={styles.insightFootnote}>
                    Start mileage: {mileageSnapshot.trackingStartMileage.toLocaleString()} km
                </Text>
                <Text style={styles.insightFootnote}>
                    Latest recorded mileage: {mileageSnapshot.latestRecordedMileage.toLocaleString()} km
                </Text>
                <Text style={styles.insightFootnote}>
                    Ownership distance: {mileageSnapshot.ownershipDistance.toLocaleString()} km
                </Text>
                <Text style={styles.insightHint}>
                    For now this is explicit tracking distance, not full ownership distance. Later we can separate
                    purchase mileage, tracking baseline, and live odometer.
                </Text>
            </View>

            <View style={styles.timelineCard}>
                <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>Smart insights</Text>
                    <Text style={styles.timelineSubtitle}>Simple signals tailored to your vehicle profile</Text>
                </View>

                {insights.length === 0 ? (
                    <Text style={styles.emptyTimeline}>
                        Add a few entries and DriveCost will start showing cost and usage patterns here.
                    </Text>
                ) : (
                    insights.map((insight) => (
                        <View key={insight.title} style={styles.timelineItem}>
                            <View style={styles.timelineCopy}>
                                <Text style={styles.timelineItemTitle}>{insight.title}</Text>
                                <Text style={styles.timelineItemMeta}>{insight.detail}</Text>
                            </View>
                            <Text style={styles.timelineAmount}>{insight.value}</Text>
                        </View>
                    ))
                )}
            </View>

            <View style={styles.timelineCard}>
                <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>Recent events</Text>
                    <Text style={styles.timelineSubtitle}>Fuel and maintenance, newest first</Text>
                </View>

                {recentEvents.length === 0 ? (
                    <Text style={styles.emptyTimeline}>Your timeline will appear here after the first entries.</Text>
                ) : (
                    recentEvents.map((event) => (
                        <View key={event.id} style={styles.timelineItem}>
                            <View style={styles.timelineCopy}>
                                <Text style={styles.timelineItemTitle}>{event.title}</Text>
                                <Text style={styles.timelineItemMeta}>{event.meta}</Text>
                                <Text style={styles.timelineItemDate}>{formatDate(event.date)}</Text>
                            </View>
                            <Text style={styles.timelineAmount}>{event.amount}</Text>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 20, paddingBottom: 28 },
    hero: { backgroundColor: '#0f172a', borderRadius: 24, padding: 20 },
    eyebrow: { color: '#bfdbfe', fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    title: { color: '#ffffff', fontSize: 28, fontWeight: '700' },
    subtitle: { color: '#cbd5e1', fontSize: 15, marginTop: 8, lineHeight: 22 },
    sectionTitle: { marginTop: 24, fontSize: 18, fontWeight: '600', color: '#0f172a' },
    insightCard: { marginTop: 16, padding: 18, borderRadius: 18, backgroundColor: '#e0f2fe' },
    insightLabel: { fontSize: 14, color: '#0369a1', marginBottom: 8 },
    insightValue: { fontSize: 24, fontWeight: '700', color: '#0c4a6e', marginBottom: 8 },
    insightFootnote: { color: '#075985', lineHeight: 20 },
    insightHint: { marginTop: 10, color: '#0c4a6e', lineHeight: 20 },
    timelineCard: {
        marginTop: 16,
        padding: 18,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    timelineHeader: { marginBottom: 12 },
    timelineTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
    timelineSubtitle: { marginTop: 4, color: '#64748b' },
    emptyTimeline: { color: '#64748b', lineHeight: 22 },
    timelineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    timelineCopy: { flex: 1, paddingRight: 16 },
    timelineItemTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
    timelineItemMeta: { marginTop: 4, color: '#475569', lineHeight: 20 },
    timelineItemDate: { marginTop: 4, color: '#94a3b8', fontSize: 13 },
    timelineAmount: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    emptyState: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
    emptyTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
    emptyText: { marginTop: 12, fontSize: 16, lineHeight: 24, color: '#475569' },
});
