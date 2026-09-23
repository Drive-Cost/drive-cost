import { Vehicle } from '../../models/Vehicle';
import { formatCostPerKm, formatCurrency } from './costCalculator';
import { getDashboardMetricCopy } from './dashboardPresentation';
import { NormalizedRecurringCostCalculation } from './recurringCosts';
import { TrackedCostCalculation } from './trackedCost';
import { getEnergyCategoryLabel, isElectricVehicle } from './vehicleProfile';
import { VehicleHistoryEvent } from './vehicleHistory';
import { VehicleInsight } from './vehicleInsights';
import { vehicleTypeForFuelType, vehicleTypeOptions } from '../../domain/vehicleType';
import { SyncStatus } from '../sync/syncStatus';

const RECENT_ACTIVITY_LIMIT = 3;

export const homeEmptyStateCopy = {
    noVehicle: {
        title: 'Add your first vehicle',
        detail: 'Start tracking your vehicle locally, then record the costs that matter to you.',
        actionLabel: 'Add a vehicle',
    },
    noEvents: {
        title: 'Start tracking your vehicle',
    },
} as const;

export function getHomeNoEventsDetail(vehicle: Vehicle): string {
    return `Add ${isElectricVehicle(vehicle) ? 'a charge' : 'a fill-up'}, maintenance entry, or ownership expense to see your recorded costs here.`;
}

export interface HomePresentation {
    vehicle: { name: string; detail: string };
    hasTrackedEvents: boolean;
    trackedCost: { title: 'Tracked costs'; value: string; scope: 'Since tracking'; coverage: string };
    secondaryMetrics: {
        costPerKm: { label: 'Tracked cost / km'; value: string };
        distance: { label: 'Driven since tracking'; value: string };
    };
    recurringCost: { label: 'Recurring costs / month'; value: string; detail: string } | null;
    breakdown: Array<{ label: string; amount: number; value: string }>;
    insights: VehicleInsight[];
    recentActivity: VehicleHistoryEvent[];
}

export function buildHomePresentation(
    vehicle: Vehicle,
    trackedCost: TrackedCostCalculation,
    recurringCost: NormalizedRecurringCostCalculation,
    insights: VehicleInsight[],
    history: VehicleHistoryEvent[],
): HomePresentation {
    const copy = getDashboardMetricCopy(vehicle);
    const energyCategory = getEnergyCategoryLabel(vehicle);
    const vehicleType = vehicleTypeForFuelType(vehicle.fuelType);
    const vehicleTypeLabel = vehicleTypeOptions.find((option) => option.id === vehicleType)?.label ?? vehicle.fuelType;
    const vehicleName = vehicle.label || `${vehicle.brand} ${vehicle.model}`;
    const vehicleDetail = [
        vehicle.label ? `${vehicle.brand} ${vehicle.model}` : null,
        vehicleTypeLabel,
        `${vehicle.currentOdometer.toLocaleString()} km`,
    ].filter((value): value is string => Boolean(value)).join(' · ');
    const breakdown = [
        trackedCost.energyEntries.length > 0 ? { label: energyCategory, amount: trackedCost.totalEnergyCost } : null,
        trackedCost.maintenanceEntries.length > 0 ? { label: 'Maintenance', amount: trackedCost.totalMaintenanceCost } : null,
        trackedCost.ownershipExpenses.length > 0 ? { label: 'Ownership expenses', amount: trackedCost.totalOwnershipExpenseCost } : null,
    ].filter((entry): entry is { label: string; amount: number } => entry !== null)
        .map((entry) => ({ ...entry, value: formatCurrency(entry.amount) }));

    return {
        vehicle: { name: vehicleName, detail: vehicleDetail },
        hasTrackedEvents: trackedCost.provenance.includedSources.length > 0,
        trackedCost: {
            title: copy.sectionTitle,
            value: formatCurrency(trackedCost.trackedCost),
            scope: copy.scopeLabel,
            coverage: copy.categorySummary,
        },
        secondaryMetrics: {
            costPerKm: { label: copy.costPerKmLabel, value: formatCostPerKm(trackedCost.costPerKm) },
            distance: {
                label: copy.drivenDistanceLabel,
                value: trackedCost.interval.trackedDistance === null
                    ? 'Unavailable'
                    : `${trackedCost.interval.trackedDistance.toLocaleString()} km`,
            },
        },
        recurringCost: recurringCost.monthlyEquivalent !== null && recurringCost.monthlyEquivalent > 0
            ? {
                label: 'Recurring costs / month',
                value: `≈ ${formatCurrency(recurringCost.monthlyEquivalent)} / month`,
                detail: 'Normalized active commitments, not payments.',
            }
            : null,
        breakdown,
        insights,
        recentActivity: history.slice(0, RECENT_ACTIVITY_LIMIT),
    };
}

export function isHomeSyncNoticeVisible(status: SyncStatus, hasTrackedEvents: boolean): boolean {
    return status.phase === 'error' || (status.phase === 'offline' && hasTrackedEvents);
}
