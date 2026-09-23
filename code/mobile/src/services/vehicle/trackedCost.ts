import { ChargingEntry } from '../../models/ChargingEntry';
import { FuelEntry } from '../../models/FuelEntry';
import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { ExpenseCategory, ExpenseEntry } from '../../models/ExpenseEntry';
import { Vehicle } from '../../models/Vehicle';
import {
    calculateCostPerKm,
    calculateTotalEnergyCost,
    calculateTotalMaintenanceCost,
    calculateTotalOwnershipExpenseCost,
} from './costCalculator';
import { EnergyEntry, EnergyEntrySource, getEnergyEntries } from './energyEntries';
import { parseCalendarDate, toCalendarDate } from '../../domain/entryDate';

export const TrackedCostCategory = {
    Fuel: 'fuel',
    Charging: 'charging',
    Maintenance: 'maintenance',
    ...ExpenseCategory,
} as const;

export type TrackedCostCategory = (typeof TrackedCostCategory)[keyof typeof TrackedCostCategory];

export interface TrackedInterval {
    period: 'since-tracking';
    trackingStartOdometer: number;
    trackingStartDate: string | null;
    latestEligibleOdometer: number | null;
    trackedDistance: number | null;
    distanceBasis: 'maximum-valid-current-or-eligible-event-odometer';
}

export interface TrackedCostSource {
    category: TrackedCostCategory;
    clientId?: string;
    localId?: number;
}

export interface TrackedCostCalculation {
    interval: TrackedInterval;
    energyEntries: EnergyEntry[];
    maintenanceEntries: MaintenanceEntry[];
    ownershipExpenses: ExpenseEntry[];
    totalEnergyCost: number;
    totalMaintenanceCost: number;
    totalOwnershipExpenseCost: number;
    trackedCost: number;
    costPerKm: number | null;
    provenance: {
        interval: TrackedInterval;
        includedCategories: TrackedCostCategory[];
        includedSources: TrackedCostSource[];
        distanceBasis: TrackedInterval['distanceBasis'];
    };
}

export function calculateTrackedCost(
    vehicle: Vehicle,
    fuelEntries: FuelEntry[],
    chargingEntries: ChargingEntry[],
    maintenanceEntries: MaintenanceEntry[],
    expenses: ExpenseEntry[] = [],
): TrackedCostCalculation {
    const energyEntries = getEnergyEntries(vehicle, fuelEntries, chargingEntries);
    const vehicleMaintenanceEntries = maintenanceEntries.filter((entry) => entry.vehicleId === vehicle.id);
    const vehicleExpenses = expenses.filter((entry) => entry.vehicleId === vehicle.id);
    const interval = createTrackedInterval(vehicle, energyEntries, vehicleMaintenanceEntries, vehicleExpenses);
    const eligibleEnergyEntries = energyEntries.filter((entry) => isEligibleEntry(entry, interval));
    const eligibleMaintenanceEntries = vehicleMaintenanceEntries.filter((entry) => isEligibleEntry(entry, interval));
    const eligibleExpenses = vehicleExpenses.filter((entry) => isEligibleExpense(entry, interval));
    const totalEnergyCost = calculateTotalEnergyCost(eligibleEnergyEntries);
    const totalMaintenanceCost = calculateTotalMaintenanceCost(eligibleMaintenanceEntries);
    const totalOwnershipExpenseCost = calculateTotalOwnershipExpenseCost(eligibleExpenses);
    const trackedCost = totalEnergyCost + totalMaintenanceCost + totalOwnershipExpenseCost;
    const hasUnboundedDateOnlyExpense = interval.trackingStartDate === null
        && eligibleExpenses.some((entry) => entry.odometer === undefined);

    return {
        interval,
        energyEntries: eligibleEnergyEntries,
        maintenanceEntries: eligibleMaintenanceEntries,
        ownershipExpenses: eligibleExpenses,
        totalEnergyCost,
        totalMaintenanceCost,
        totalOwnershipExpenseCost,
        trackedCost,
        // A legacy dated-only payment has no odometer or calendar anchor. It
        // belongs in recorded tracked cost, but cannot be assigned to distance.
        costPerKm: hasUnboundedDateOnlyExpense ? null : calculateCostPerKm(trackedCost, interval.trackedDistance),
        provenance: {
            interval,
            includedCategories: includedCategories(eligibleEnergyEntries, eligibleMaintenanceEntries, eligibleExpenses),
            includedSources: [
                ...eligibleEnergyEntries.map((entry) => ({
                    category: categoryForEnergy(entry),
                    clientId: entry.clientId,
                    localId: entry.id,
                })),
                ...eligibleMaintenanceEntries.map((entry) => ({
                    category: TrackedCostCategory.Maintenance,
                    clientId: entry.clientId,
                    localId: entry.id,
                })),
                ...eligibleExpenses.map((entry) => ({
                    category: entry.category,
                    clientId: entry.clientId,
                    localId: entry.id,
                })),
            ],
            distanceBasis: interval.distanceBasis,
        },
    };
}

function createTrackedInterval(
    vehicle: Vehicle,
    energyEntries: EnergyEntry[],
    maintenanceEntries: MaintenanceEntry[],
    expenses: ExpenseEntry[],
): TrackedInterval {
    const trackingStartOdometer = vehicle.trackingStartMileage;
    const trackingStartDate = vehicle.trackingStartDate ?? null;
    const validOdometers = [
        vehicle.currentOdometer,
        ...energyEntries.map((entry) => entry.odometer),
        ...maintenanceEntries.map((entry) => entry.odometer),
        ...expenses
            .filter((entry) => trackingStartDate === null || isOnOrAfterTrackingStart(entry.date, trackingStartDate))
            .map((entry) => entry.odometer),
    ].filter((odometer): odometer is number => typeof odometer === 'number' && Number.isFinite(odometer) && odometer >= trackingStartOdometer);
    const latestEligibleOdometer = validOdometers.length ? Math.max(...validOdometers) : null;

    return {
        period: 'since-tracking',
        trackingStartOdometer,
        trackingStartDate,
        latestEligibleOdometer,
        trackedDistance: latestEligibleOdometer === null ? null : latestEligibleOdometer - trackingStartOdometer,
        distanceBasis: 'maximum-valid-current-or-eligible-event-odometer',
    };
}

function isEligibleExpense(entry: ExpenseEntry, interval: TrackedInterval): boolean {
    if (!Number.isFinite(entry.totalPaid) || entry.totalPaid <= 0) return false;

    const dateIsEligible = interval.trackingStartDate === null || isOnOrAfterTrackingStart(entry.date, interval.trackingStartDate);

    if (entry.odometer === undefined) {
        // Legacy vehicles can have no calendar anchor. Preserve a valid
        // date-only payment rather than silently losing it, but keep cost/km
        // unavailable below because it cannot be assigned to distance.
        return dateIsEligible;
    }

    return interval.latestEligibleOdometer !== null
        && Number.isFinite(entry.odometer)
        && entry.odometer >= interval.trackingStartOdometer
        && entry.odometer <= interval.latestEligibleOdometer
        && dateIsEligible;
}

function isOnOrAfterTrackingStart(value: string, trackingStartDate: string): boolean {
    const calendarDate = toCalendarDate(value);
    return parseCalendarDate(calendarDate) !== null && calendarDate >= trackingStartDate;
}

function isEligibleEntry(
    entry: Pick<EnergyEntry, 'odometer' | 'amount'> | Pick<MaintenanceEntry, 'odometer' | 'cost'>,
    interval: TrackedInterval,
): boolean {
    if (interval.latestEligibleOdometer === null || !Number.isFinite(entry.odometer)) return false;

    const amount = 'amount' in entry ? entry.amount : entry.cost;
    return Number.isFinite(amount)
        && entry.odometer >= interval.trackingStartOdometer
        && entry.odometer <= interval.latestEligibleOdometer;
}

function categoryForEnergy(entry: EnergyEntry): TrackedCostCategory {
    return entry.source === EnergyEntrySource.Fuel ? TrackedCostCategory.Fuel : TrackedCostCategory.Charging;
}

function includedCategories(
    energyEntries: EnergyEntry[],
    maintenanceEntries: MaintenanceEntry[],
    expenses: ExpenseEntry[],
): TrackedCostCategory[] {
    const categories = new Set<TrackedCostCategory>();

    energyEntries.forEach((entry) => categories.add(categoryForEnergy(entry)));
    if (maintenanceEntries.length) categories.add(TrackedCostCategory.Maintenance);
    expenses.forEach((entry) => categories.add(entry.category));

    return [...Object.values(TrackedCostCategory)]
        .filter((category) => categories.has(category));
}
