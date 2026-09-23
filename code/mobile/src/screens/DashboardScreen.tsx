import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import SyncStatusCard from '../components/SyncStatusCard';
import { todayCalendarDate } from '../domain/entryDate';
import { getVehicleCreationDestination } from '../navigation/primaryNavigation';
import { homeDestinations } from '../navigation/homeNavigation';
import { AppTabParamList } from '../navigation/types';
import { useChargingStore } from '../store/chargingStore';
import { useExpenseStore } from '../store/expenseStore';
import { useFuelStore } from '../store/fuelStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useRecurringExpenseStore } from '../store/recurringExpenseStore';
import { useSyncStore } from '../store/syncStore';
import { useVehicleStore } from '../store/vehicleStore';
import { syncDevice } from '../services/sync/syncService';
import { formatCurrency } from '../services/vehicle/costCalculator';
import { getActiveVehicle } from '../services/vehicle/activeVehicle';
import { calculateFuelConsumption } from '../services/vehicle/fuelConsumption';
import { buildHomePresentation, getHomeNoEventsDetail, homeEmptyStateCopy, isHomeSyncNoticeVisible } from '../services/vehicle/homePresentation';
import { calculateNormalizedRecurringCost } from '../services/vehicle/recurringCosts';
import { calculateTrackedCost } from '../services/vehicle/trackedCost';
import { buildVehicleHistory } from '../services/vehicle/vehicleHistory';
import { buildVehicleInsights } from '../services/vehicle/vehicleInsights';

type DashboardScreenProps = BottomTabScreenProps<AppTabParamList, 'Home'>;

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
    const { vehicles, activeVehicleId } = useVehicleStore();
    const { fuelEntries, loadFuelEntries } = useFuelStore();
    const { chargingEntries, loadChargingEntries } = useChargingStore();
    const { maintenanceEntries, loadMaintenanceEntries } = useMaintenanceStore();
    const { expenseEntries, loadExpenseEntries } = useExpenseStore();
    const { recurringExpenses, loadRecurringExpenses } = useRecurringExpenseStore();
    const syncStatus = useSyncStore();
    const vehicle = getActiveVehicle(vehicles, activeVehicleId);

    useEffect(() => {
        if (activeVehicleId === null) return;

        void Promise.all([
            loadFuelEntries(activeVehicleId),
            loadChargingEntries(activeVehicleId),
            loadMaintenanceEntries(activeVehicleId),
            loadExpenseEntries(activeVehicleId),
            loadRecurringExpenses(activeVehicleId),
        ]);
    }, [activeVehicleId, loadChargingEntries, loadExpenseEntries, loadFuelEntries, loadMaintenanceEntries, loadRecurringExpenses]);

    if (!vehicle || activeVehicleId === null) {
        const creationDestination = getVehicleCreationDestination();
        const emptyState = homeEmptyStateCopy.noVehicle;
        return (
            <SafeAreaView edges={['top']} style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{emptyState.title}</Text>
                <Text style={styles.emptyText}>{emptyState.detail}</Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={emptyState.actionLabel}
                    style={styles.primaryButton}
                    onPress={() => navigation.navigate(creationDestination.tab, { screen: creationDestination.screen })}
                >
                    <Text style={styles.primaryButtonText}>{emptyState.actionLabel}</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    const activeFuelEntries = fuelEntries.filter((entry) => entry.vehicleId === activeVehicleId);
    const activeChargingEntries = chargingEntries.filter((entry) => entry.vehicleId === activeVehicleId);
    const activeMaintenanceEntries = maintenanceEntries.filter((entry) => entry.vehicleId === activeVehicleId);
    const activeExpenseEntries = expenseEntries.filter((entry) => entry.vehicleId === activeVehicleId);
    const trackedCost = calculateTrackedCost(vehicle, activeFuelEntries, activeChargingEntries, activeMaintenanceEntries, activeExpenseEntries);
    const history = buildVehicleHistory(vehicle, activeFuelEntries, activeMaintenanceEntries, activeChargingEntries, activeExpenseEntries);
    const insights = buildVehicleInsights(
        vehicle,
        trackedCost.energyEntries,
        trackedCost.maintenanceEntries,
        trackedCost.totalEnergyCost,
        trackedCost.totalMaintenanceCost,
        calculateFuelConsumption(activeFuelEntries),
        trackedCost.totalOwnershipExpenseCost,
    );
    const home = buildHomePresentation(
        vehicle,
        trackedCost,
        calculateNormalizedRecurringCost(vehicle, recurringExpenses, todayCalendarDate()),
        insights,
        history,
    );

    return (
        <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.pageTitle}>Home</Text>
            <View style={styles.vehicleHeader}>
                <Text style={styles.vehicleEyebrow}>Active vehicle</Text>
                <Text style={styles.vehicleName}>{home.vehicle.name}</Text>
                <Text style={styles.vehicleDetail}>{home.vehicle.detail}</Text>
            </View>

            {isHomeSyncNoticeVisible(syncStatus, home.hasTrackedEvents) ? (
                <SyncStatusCard status={syncStatus} onRetry={() => { void syncDevice().catch(() => undefined); }} />
            ) : null}

            {home.hasTrackedEvents ? (
                <>
                    <View style={styles.costHero}>
                        <Text style={styles.costHeroLabel}>{home.trackedCost.title}</Text>
                        <Text style={styles.costHeroValue}>{home.trackedCost.value}</Text>
                        <Text style={styles.costHeroScope}>{home.trackedCost.scope}</Text>
                    </View>

                    <View style={styles.metricRow}>
                        <HomeMetric label={home.secondaryMetrics.costPerKm.label} value={home.secondaryMetrics.costPerKm.value} />
                        <HomeMetric label={home.secondaryMetrics.distance.label} value={home.secondaryMetrics.distance.value} />
                    </View>

                    <Text style={styles.coverage}>{home.trackedCost.coverage}</Text>

                    {home.recurringCost ? (
                        <View style={styles.recurringSection}>
                            <Text style={styles.recurringLabel}>{home.recurringCost.label}</Text>
                            <Text style={styles.recurringValue}>{home.recurringCost.value}</Text>
                            <Text style={styles.recurringDetail}>{home.recurringCost.detail}</Text>
                        </View>
                    ) : null}

                    {home.breakdown.length > 0 ? (
                        <HomeSection title="Cost breakdown">
                            {home.breakdown.map((entry) => (
                                <View key={entry.label} style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>{entry.label}</Text>
                                    <Text style={styles.breakdownAmount}>{entry.value}</Text>
                                </View>
                            ))}
                            <View style={styles.breakdownTotal}>
                                <Text style={styles.breakdownTotalLabel}>Tracked costs</Text>
                                <Text style={styles.breakdownTotalAmount}>{home.trackedCost.value}</Text>
                            </View>
                        </HomeSection>
                    ) : null}

                    {home.insights.length > 0 ? (
                        <HomeSection title="Insights">
                            {home.insights.map((insight) => (
                                <View key={insight.title} style={styles.insightRow}>
                                    <View style={styles.insightCopy}>
                                        <Text style={styles.insightTitle}>{insight.title}</Text>
                                        <Text style={styles.insightDetail}>{insight.detail}</Text>
                                    </View>
                                    <Text style={styles.insightValue}>{insight.value}</Text>
                                </View>
                            ))}
                        </HomeSection>
                    ) : null}

                    {home.recentActivity.length > 0 ? (
                        <HomeSection title="Recent activity" actionLabel="View history" onAction={() => navigation.navigate(homeDestinations.history)}>
                            {home.recentActivity.map((event) => (
                                <View key={event.id} style={styles.activityRow}>
                                    <View style={styles.activityCopy}>
                                        <Text style={styles.activityTitle}>{event.title}</Text>
                                        <Text style={styles.activityDetail}>{event.detail}</Text>
                                        <Text style={styles.activityDate}>{formatDate(event.date)}</Text>
                                    </View>
                                    <Text style={styles.activityAmount}>{formatCurrency(event.amount)}</Text>
                                </View>
                            ))}
                        </HomeSection>
                    ) : null}
                </>
            ) : (
                <View style={styles.startSection}>
                    <Text style={styles.startTitle}>{homeEmptyStateCopy.noEvents.title}</Text>
                    <Text style={styles.startCopy}>{getHomeNoEventsDetail(vehicle)}</Text>
                </View>
            )}

            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quick add"
                style={styles.quickAddButton}
                onPress={() => navigation.navigate(homeDestinations.quickAdd)}
            >
                <Text style={styles.quickAddButtonText}>Quick add</Text>
            </Pressable>
        </ScrollView>
        </SafeAreaView>
    );
}

function HomeMetric({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.metric}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
        </View>
    );
}

function HomeSection({ title, actionLabel, onAction, children }: {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {actionLabel && onAction ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction}>
                        <Text style={styles.sectionAction}>{actionLabel}</Text>
                    </Pressable>
                ) : null}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 20, paddingBottom: 36 },
    pageTitle: { color: '#0f172a', fontSize: 28, fontWeight: '700' },
    vehicleHeader: { paddingTop: 20, paddingBottom: 24 },
    vehicleEyebrow: { color: '#64748b', fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
    vehicleName: { marginTop: 8, color: '#0f172a', fontSize: 30, fontWeight: '700' },
    vehicleDetail: { marginTop: 6, color: '#475569', fontSize: 16 },
    costHero: { borderRadius: 24, padding: 22, backgroundColor: '#0f172a' },
    costHeroLabel: { color: '#bfdbfe', fontSize: 15, fontWeight: '600' },
    costHeroValue: { marginTop: 10, color: '#ffffff', fontSize: 36, fontWeight: '700' },
    costHeroScope: { marginTop: 8, color: '#cbd5e1', fontSize: 15 },
    metricRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
    metric: { flex: 1, padding: 16, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
    metricValue: { color: '#0f172a', fontSize: 20, fontWeight: '700' },
    metricLabel: { marginTop: 6, color: '#64748b', fontSize: 14 },
    coverage: { marginTop: 14, color: '#64748b', fontSize: 13, lineHeight: 19 },
    recurringSection: { marginTop: 24, padding: 18, borderRadius: 18, backgroundColor: '#e0f2fe' },
    recurringLabel: { color: '#075985', fontSize: 14, fontWeight: '600' },
    recurringValue: { marginTop: 8, color: '#0c4a6e', fontSize: 24, fontWeight: '700' },
    recurringDetail: { marginTop: 6, color: '#075985', lineHeight: 20 },
    section: { marginTop: 24, paddingTop: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { color: '#0f172a', fontSize: 19, fontWeight: '700' },
    sectionAction: { color: '#0369a1', fontWeight: '700' },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    breakdownLabel: { color: '#475569', fontSize: 16 },
    breakdownAmount: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
    breakdownTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 13 },
    breakdownTotalLabel: { color: '#0f172a', fontWeight: '700' },
    breakdownTotalAmount: { color: '#0f172a', fontWeight: '700' },
    insightRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    insightCopy: { flex: 1, paddingRight: 16 },
    insightTitle: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
    insightDetail: { marginTop: 4, color: '#64748b', lineHeight: 20 },
    insightValue: { color: '#0f172a', fontWeight: '700' },
    activityRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    activityCopy: { flex: 1, paddingRight: 16 },
    activityTitle: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
    activityDetail: { marginTop: 4, color: '#475569', lineHeight: 20 },
    activityDate: { marginTop: 4, color: '#94a3b8', fontSize: 13 },
    activityAmount: { color: '#0f172a', fontWeight: '700' },
    startSection: { marginTop: 6, padding: 22, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
    startTitle: { color: '#0f172a', fontSize: 21, fontWeight: '700' },
    startCopy: { marginTop: 8, color: '#475569', lineHeight: 22 },
    quickAddButton: { marginTop: 24, alignItems: 'center', borderRadius: 16, paddingVertical: 15, backgroundColor: '#0f172a' },
    quickAddButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    emptyState: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
    emptyTitle: { color: '#0f172a', fontSize: 26, fontWeight: '700' },
    emptyText: { marginTop: 12, color: '#475569', fontSize: 16, lineHeight: 24 },
    primaryButton: { marginTop: 22, alignItems: 'center', borderRadius: 16, paddingVertical: 15, backgroundColor: '#0f172a' },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
