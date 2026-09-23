import { describe, expect, it } from 'vitest';
import { ExpenseCategory } from '../../../src/models/ExpenseEntry';
import { FuelFillStatus } from '../../../src/models/FuelEntry';
import { getHomeNoEventsDetail, homeEmptyStateCopy, buildHomePresentation, isHomeSyncNoticeVisible } from '../../../src/services/vehicle/homePresentation';
import { calculateNormalizedRecurringCost } from '../../../src/services/vehicle/recurringCosts';
import { calculateTrackedCost } from '../../../src/services/vehicle/trackedCost';
import { buildVehicleHistory } from '../../../src/services/vehicle/vehicleHistory';
import { buildVehicleInsights } from '../../../src/services/vehicle/vehicleInsights';
import { calculateFuelConsumption } from '../../../src/services/vehicle/fuelConsumption';
import { EnergyEntrySource } from '../../../src/services/vehicle/energyEntries';
import { TrackedCostCalculation } from '../../../src/services/vehicle/trackedCost';
import { NormalizedRecurringCostCalculation } from '../../../src/services/vehicle/recurringCosts';
import { VehicleInsight } from '../../../src/services/vehicle/vehicleInsights';
import { VehicleHistoryEvent } from '../../../src/services/vehicle/vehicleHistory';
import { Vehicle } from '../../../src/models/Vehicle';

const iceVehicle = {
    id: 1,
    clientId: 'vehicle-1',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    fuelType: 'Petrol',
    ownershipStartMileage: 8_000,
    trackingStartMileage: 10_000,
    trackingStartDate: '2026-01-01',
    currentOdometer: 12_000,
};

function homeFor(
    vehicle: Vehicle = iceVehicle,
    tracked: TrackedCostCalculation = calculateTrackedCost(vehicle, [], [], []),
    recurring: NormalizedRecurringCostCalculation = calculateNormalizedRecurringCost(vehicle, [], '2026-06-01'),
    insights: VehicleInsight[] = [],
    history: VehicleHistoryEvent[] = [],
) {
    return buildHomePresentation(vehicle, tracked, recurring, insights, history);
}

describe('Home presentation', () => {
    it('uses the central tracked-cost calculation for the hero and a reconciling transaction breakdown', () => {
        const tracked = calculateTrackedCost(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-1', vehicleId: 1, date: '2026-01-02', liters: 40, price: 60, odometer: 10_500, fillStatus: FuelFillStatus.Full }],
            [],
            [{ id: 2, clientId: 'maintenance-1', vehicleId: 1, type: 'Service', description: '', cost: 40, date: '2026-01-03', odometer: 10_600 }],
            [{ id: 3, clientId: 'expense-1', vehicleId: 1, category: ExpenseCategory.Insurance, totalPaid: 20, date: '2026-01-04', odometer: 10_700 }],
        );
        const home = homeFor(iceVehicle, tracked);

        expect(home.trackedCost).toMatchObject({ title: 'Tracked costs', value: 'EUR 120.00', scope: 'Since tracking' });
        expect(home.breakdown).toEqual([
            { label: 'Fuel', amount: 60, value: 'EUR 60.00' },
            { label: 'Maintenance', amount: 40, value: 'EUR 40.00' },
            { label: 'Ownership expenses', amount: 20, value: 'EUR 20.00' },
        ]);
        expect(home.breakdown.reduce((total, entry) => total + entry.amount, 0)).toBe(tracked.trackedCost);
        expect(home.trackedCost.coverage).toBe('Recorded fuel, maintenance, and ownership expenses. Depreciation is not included.');
    });

    it('keeps normalized recurring commitments separate from transaction-based tracked cost', () => {
        const tracked = calculateTrackedCost(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-1', vehicleId: 1, date: '2026-01-02', liters: 40, price: 60, odometer: 10_500, fillStatus: FuelFillStatus.Full }],
            [],
            [],
        );
        const recurring = calculateNormalizedRecurringCost(iceVehicle, [{
            id: 4,
            clientId: 'recurring-1',
            vehicleId: 1,
            category: ExpenseCategory.Insurance,
            amount: 480,
            periodMonths: 12,
            startDate: '2026-01-01',
            active: true,
        }], '2026-06-01');
        const home = homeFor(iceVehicle, tracked, recurring);

        expect(home.trackedCost.value).toBe('EUR 60.00');
        expect(home.recurringCost).toEqual({
            label: 'Recurring costs / month',
            value: '≈ EUR 40.00 / month',
            detail: 'Normalized active commitments, not payments.',
        });

        const legacyVehicle = { ...iceVehicle, trackingStartDate: null };
        expect(homeFor(
            legacyVehicle,
            calculateTrackedCost(legacyVehicle, [], [], []),
            calculateNormalizedRecurringCost(legacyVehicle, recurring.eligibleSchedules, '2026-06-01'),
        ).recurringCost).toBeNull();
    });

    it('keeps unavailable cost per km unavailable and presents valid zero cost per km as zero', () => {
        const unavailableTracked = calculateTrackedCost(
            { ...iceVehicle, currentOdometer: 10_000 },
            [{ id: 1, clientId: 'at-start', vehicleId: 1, date: '2026-01-02', liters: 40, price: 60, odometer: 10_000, fillStatus: FuelFillStatus.Full }],
            [],
            [],
        );
        const zeroTracked = calculateTrackedCost(iceVehicle, [], [], []);

        expect(homeFor(iceVehicle, unavailableTracked).secondaryMetrics.costPerKm.value).toBe('Unavailable');
        expect(homeFor(iceVehicle, zeroTracked).secondaryMetrics.costPerKm.value).toBe('EUR 0.00/km');
    });

    it('uses fuel terminology for ICE and combines legacy and current EV energy records once as charging', () => {
        const evVehicle = { ...iceVehicle, id: 2, clientId: 'vehicle-2', fuelType: 'EV', currentOdometer: 10_600 };
        const evTracked = calculateTrackedCost(
            evVehicle,
            [{ id: 1, clientId: 'legacy-charge', vehicleId: 2, date: '2026-01-02', liters: 20, price: 8, odometer: 10_200, fillStatus: FuelFillStatus.Unknown }],
            [{ id: 2, clientId: 'charge-1', vehicleId: 2, date: '2026-01-03', kWh: 30, price: 12, odometer: 10_500 }],
            [],
        );

        expect(homeFor().breakdown).toEqual([]);
        expect(homeFor(evVehicle, evTracked).breakdown).toEqual([{ label: 'Charging', amount: 20, value: 'EUR 20.00' }]);
        expect(homeFor(evVehicle, evTracked).trackedCost.value).toBe('EUR 20.00');
    });

    it('surfaces valid deterministic insights but does not add unsupported consumption claims', () => {
        const fuelConsumption = calculateFuelConsumption([
            { id: 1, clientId: 'full-1', vehicleId: 1, date: '2026-01-01', liters: 40, price: 60, odometer: 10_000, fillStatus: FuelFillStatus.Full },
            { id: 2, clientId: 'full-2', vehicleId: 1, date: '2026-01-02', liters: 35, price: 52.5, odometer: 10_500, fillStatus: FuelFillStatus.Full },
        ]);
        const validInsights = buildVehicleInsights(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-1', vehicleId: 1, date: '2026-01-02', quantity: 35, amount: 52.5, odometer: 10_500, source: EnergyEntrySource.Fuel }],
            [],
            52.5,
            0,
            fuelConsumption,
        );
        const unsupportedInsights = buildVehicleInsights(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-1', vehicleId: 1, date: '2026-01-02', quantity: 35, amount: 52.5, odometer: 10_500, source: EnergyEntrySource.Fuel }],
            [],
            52.5,
            0,
            null,
        );

        expect(homeFor(iceVehicle, undefined, undefined, validInsights).insights.map((insight) => insight.title)).toContain('Latest fuel consumption');
        expect(homeFor(iceVehicle, undefined, undefined, unsupportedInsights).insights.map((insight) => insight.title)).not.toContain('Latest fuel consumption');
        expect(homeFor().insights).toEqual([]);
    });

    it('shows only recent active-vehicle transaction activity and omits recurring schedules', () => {
        const history = buildVehicleHistory(
            iceVehicle,
            [
                { id: 1, clientId: 'fuel-current', vehicleId: 1, date: '2026-02-03', liters: 40, price: 60, odometer: 10_500, fillStatus: FuelFillStatus.Full },
                { id: 2, clientId: 'fuel-other', vehicleId: 2, date: '2026-02-05', liters: 40, price: 60, odometer: 10_500, fillStatus: FuelFillStatus.Full },
            ],
            [
                { id: 3, clientId: 'maintenance-current', vehicleId: 1, type: 'Service', description: '', cost: 40, date: '2026-02-02', odometer: 10_400 },
                { id: 4, clientId: 'maintenance-current-older', vehicleId: 1, type: 'Tyres', description: '', cost: 20, date: '2026-02-01', odometer: 10_300 },
                { id: 5, clientId: 'maintenance-current-oldest', vehicleId: 1, type: 'Repair', description: '', cost: 10, date: '2026-01-31', odometer: 10_200 },
                { id: 7, clientId: 'maintenance-other', vehicleId: 2, type: 'Other vehicle repair', description: '', cost: 80, date: '2026-02-06', odometer: 10_600 },
            ],
            [],
            [{ id: 6, clientId: 'expense-other', vehicleId: 2, category: ExpenseCategory.Parking, totalPaid: 5, date: '2026-02-04' }],
        );
        const home = homeFor(iceVehicle, undefined, undefined, [], history);

        expect(home.recentActivity.map((event) => event.id)).toEqual(['fuel-1', 'maintenance-3', 'maintenance-4']);
        expect(home.recentActivity.map((event) => event.title)).not.toContain('Insurance');
        expect(home.recentActivity.map((event) => event.title)).not.toContain('Other vehicle repair');
    });

    it('keeps empty and partial-data states useful without rendering a zero-cost dashboard', () => {
        const noEvents = homeFor();
        const maintenanceTracked = calculateTrackedCost(
            iceVehicle,
            [],
            [],
            [{ id: 1, clientId: 'maintenance-1', vehicleId: 1, type: 'Service', description: '', cost: 40, date: '2026-01-02', odometer: 10_500 }],
        );
        const partial = homeFor(iceVehicle, maintenanceTracked);

        expect(noEvents.hasTrackedEvents).toBe(false);
        expect(homeEmptyStateCopy).toMatchObject({
            noVehicle: { actionLabel: 'Add a vehicle' },
            noEvents: { title: 'Start tracking your vehicle' },
        });
        expect(getHomeNoEventsDetail(iceVehicle)).toContain('a fill-up');
        expect(getHomeNoEventsDetail({ ...iceVehicle, fuelType: 'EV' })).toContain('a charge');
        expect(partial.hasTrackedEvents).toBe(true);
        expect(partial.breakdown).toEqual([{ label: 'Maintenance', amount: 40, value: 'EUR 40.00' }]);
    });

    it('keeps normal sync invisible while retaining offline and error notices', () => {
        expect(isHomeSyncNoticeVisible({ phase: 'synced', lastSyncedAt: '2026-01-01', error: null }, true)).toBe(false);
        expect(isHomeSyncNoticeVisible({ phase: 'syncing', lastSyncedAt: null, error: null }, true)).toBe(false);
        expect(isHomeSyncNoticeVisible({ phase: 'offline', lastSyncedAt: null, error: null }, false)).toBe(false);
        expect(isHomeSyncNoticeVisible({ phase: 'offline', lastSyncedAt: null, error: null }, true)).toBe(true);
        expect(isHomeSyncNoticeVisible({ phase: 'error', lastSyncedAt: null, error: 'Network failed' }, false)).toBe(true);
    });

    it('uses consumer copy without internal tracking terms or true-cost claims', () => {
        const visibleCopy = [
            ...Object.values(homeFor().trackedCost),
            homeEmptyStateCopy.noVehicle.title,
            homeEmptyStateCopy.noEvents.title,
        ].join(' ');

        expect(visibleCopy).not.toMatch(/trackingStartMileage|trackingStartDate|ownershipStartMileage|true ownership cost/i);
    });
});
