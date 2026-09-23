import { describe, expect, it } from 'vitest';
import { calculateTrackedCost } from '../../../src/services/vehicle/trackedCost';
import { FuelFillStatus } from '../../../src/models/FuelEntry';
import { ExpenseCategory } from '../../../src/models/ExpenseEntry';

const iceVehicle = {
    id: 1,
    clientId: 'ice-vehicle',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    fuelType: 'Petrol',
    ownershipStartMileage: 8_000,
    trackingStartMileage: 10_000,
    currentOdometer: 13_000,
};

const evVehicle = {
    ...iceVehicle,
    id: 2,
    clientId: 'ev-vehicle',
    fuelType: 'EV',
    currentOdometer: 10_600,
};

describe('calculateTrackedCost', () => {
    it('includes baseline and later fuel entries, but excludes a pre-baseline entry', () => {
        const result = calculateTrackedCost(
            iceVehicle,
            [
                { id: 1, clientId: 'pre-baseline', vehicleId: 1, date: '2026-01-01', liters: 20, price: 30, odometer: 9_999, fillStatus: FuelFillStatus.Unknown },
                { id: 2, clientId: 'at-baseline', vehicleId: 1, date: '2026-01-02', liters: 30, price: 45, odometer: 10_000, fillStatus: FuelFillStatus.Unknown },
                { id: 3, clientId: 'later-fuel', vehicleId: 1, date: '2026-01-03', liters: 35, price: 52.5, odometer: 12_500, fillStatus: FuelFillStatus.Unknown },
            ],
            [],
            [],
        );

        expect(result.totalEnergyCost).toBe(97.5);
        expect(result.energyEntries.map((entry) => entry.clientId)).toEqual(['at-baseline', 'later-fuel']);
        expect(result.interval).toMatchObject({
            period: 'since-tracking',
            trackingStartOdometer: 10_000,
            latestEligibleOdometer: 13_000,
            trackedDistance: 3_000,
        });
    });

    it('uses the latest reading without allowing a stale or out-of-order reading to reduce distance', () => {
        const result = calculateTrackedCost(
            iceVehicle,
            [
                { id: 1, clientId: 'latest-fuel', vehicleId: 1, date: '2026-02-01', liters: 20, price: 30, odometer: 12_500, fillStatus: FuelFillStatus.Unknown },
                { id: 2, clientId: 'stale-fuel', vehicleId: 1, date: '2026-02-02', liters: 10, price: 15, odometer: 10_500, fillStatus: FuelFillStatus.Unknown },
            ],
            [],
            [],
        );

        expect(result.interval.latestEligibleOdometer).toBe(13_000);
        expect(result.interval.trackedDistance).toBe(3_000);
        expect(result.totalEnergyCost).toBe(45);
    });

    it('applies the same inclusive tracked interval to maintenance costs', () => {
        const result = calculateTrackedCost(
            iceVehicle,
            [],
            [],
            [
                { id: 1, clientId: 'pre-maintenance', vehicleId: 1, type: 'Repair', description: '', cost: 80, date: '2026-02-01', odometer: 9_900 },
                { id: 2, clientId: 'baseline-maintenance', vehicleId: 1, type: 'Service', description: '', cost: 50, date: '2026-02-02', odometer: 10_000 },
                { id: 3, clientId: 'later-maintenance', vehicleId: 1, type: 'Tyres', description: '', cost: 120, date: '2026-02-03', odometer: 12_000 },
            ],
        );

        expect(result.totalMaintenanceCost).toBe(170);
        expect(result.maintenanceEntries.map((entry) => entry.clientId)).toEqual(['baseline-maintenance', 'later-maintenance']);
    });

    it('calculates a charging-only EV using the authoritative charging projection', () => {
        const result = calculateTrackedCost(
            evVehicle,
            [],
            [{ id: 10, clientId: 'charge-1', vehicleId: 2, date: '2026-03-01', kWh: 24, price: 9.6, odometer: 10_500 }],
            [],
        );

        expect(result.totalEnergyCost).toBe(9.6);
        expect(result.interval.trackedDistance).toBe(600);
        expect(result.costPerKm).toBe(0.016);
        expect(result.provenance.includedCategories).toEqual(['charging']);
    });

    it('combines eligible maintenance and energy records in one tracked calculation', () => {
        const result = calculateTrackedCost(
            evVehicle,
            [{ id: 11, clientId: 'legacy-charge', vehicleId: 2, date: '2026-03-01', liters: 20, price: 8, odometer: 10_200, fillStatus: FuelFillStatus.Unknown }],
            [{ id: 12, clientId: 'charge-2', vehicleId: 2, date: '2026-03-02', kWh: 30, price: 12, odometer: 10_500 }],
            [
                { id: 13, clientId: 'maintenance-1', vehicleId: 2, type: 'Service', description: 'Inspection', cost: 70, date: '2026-03-03', odometer: 10_400 },
                { id: 14, clientId: 'other-vehicle-maintenance', vehicleId: 1, type: 'Service', description: '', cost: 100, date: '2026-03-03', odometer: 10_400 },
            ],
        );

        expect(result.trackedCost).toBe(90);
        expect(result.costPerKm).toBe(0.15);
        expect(result.provenance.includedCategories).toEqual(['charging', 'maintenance']);
        expect(result.provenance.includedSources).toEqual([
            { category: 'charging', clientId: 'legacy-charge', localId: 11 },
            { category: 'charging', clientId: 'charge-2', localId: 12 },
            { category: 'maintenance', clientId: 'maintenance-1', localId: 13 },
        ]);
    });

    it('makes cost per km unavailable for zero distance while retaining the tracked cost', () => {
        const result = calculateTrackedCost(
            { ...iceVehicle, currentOdometer: 10_000 },
            [{ id: 1, clientId: 'baseline-fuel', vehicleId: 1, date: '2026-04-01', liters: 20, price: 30, odometer: 10_000, fillStatus: FuelFillStatus.Unknown }],
            [],
            [],
        );

        expect(result.trackedCost).toBe(30);
        expect(result.interval.trackedDistance).toBe(0);
        expect(result.costPerKm).toBeNull();
    });

    it('keeps zero cost per km valid with a positive tracked distance', () => {
        const result = calculateTrackedCost({ ...iceVehicle, currentOdometer: 10_500 }, [], [], []);

        expect(result.trackedCost).toBe(0);
        expect(result.costPerKm).toBe(0);
    });

    it('excludes an edited entry after it crosses below the tracking baseline', () => {
        const eligibleEntry = { id: 1, clientId: 'editable-fuel', vehicleId: 1, date: '2026-05-01', liters: 20, price: 30, odometer: 10_100, fillStatus: FuelFillStatus.Unknown };
        const beforeEdit = calculateTrackedCost(iceVehicle, [eligibleEntry], [], []);
        const afterEdit = calculateTrackedCost(iceVehicle, [{ ...eligibleEntry, odometer: 9_900 }], [], []);

        expect(beforeEdit.trackedCost).toBe(30);
        expect(afterEdit.trackedCost).toBe(0);
        expect(afterEdit.provenance.includedSources).toEqual([]);
    });

    it('returns unavailable distance when every known reading is below the tracking baseline', () => {
        const result = calculateTrackedCost(
            { ...iceVehicle, currentOdometer: 9_900 },
            [{ id: 1, clientId: 'invalid-fuel', vehicleId: 1, date: '2026-06-01', liters: 20, price: 30, odometer: 9_800, fillStatus: FuelFillStatus.Unknown }],
            [],
            [],
        );

        expect(result.interval.latestEligibleOdometer).toBeNull();
        expect(result.interval.trackedDistance).toBeNull();
        expect(result.costPerKm).toBeNull();
    });

    it('records complete interval and distance provenance', () => {
        const result = calculateTrackedCost(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-provenance', vehicleId: 1, date: '2026-07-01', liters: 20, price: 30, odometer: 11_000, fillStatus: FuelFillStatus.Unknown }],
            [],
            [],
        );

        expect(result.provenance).toEqual({
            interval: {
                period: 'since-tracking',
                trackingStartOdometer: 10_000,
                trackingStartDate: null,
                latestEligibleOdometer: 13_000,
                trackedDistance: 3_000,
                distanceBasis: 'maximum-valid-current-or-eligible-event-odometer',
            },
            includedCategories: ['fuel'],
            includedSources: [{ category: 'fuel', clientId: 'fuel-provenance', localId: 1 }],
            distanceBasis: 'maximum-valid-current-or-eligible-event-odometer',
        });
    });

    it('includes eligible ownership expenses once with their category and stable source identity', () => {
        const result = calculateTrackedCost(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-1', vehicleId: 1, date: '2026-07-01', liters: 20, price: 30, odometer: 11_000, fillStatus: FuelFillStatus.Unknown }],
            [],
            [{ id: 2, clientId: 'maintenance-1', vehicleId: 1, type: 'Service', description: '', cost: 80, date: '2026-07-02', odometer: 11_100 }],
            [{ id: 3, clientId: 'insurance-1', vehicleId: 1, category: ExpenseCategory.Insurance, totalPaid: 120, date: '2026-07-03', odometer: 11_200 }],
        );

        expect(result).toMatchObject({ totalEnergyCost: 30, totalMaintenanceCost: 80, totalOwnershipExpenseCost: 120, trackedCost: 230 });
        expect(result.provenance.includedCategories).toEqual(['fuel', 'maintenance', 'insurance']);
        expect(result.provenance.includedSources).toContainEqual({ category: 'insurance', clientId: 'insurance-1', localId: 3 });
    });

    it('includes a valid expense without an odometer in tracked cost but does not invent a cost/km interval', () => {
        const result = calculateTrackedCost(
            iceVehicle,
            [],
            [],
            [],
            [{ id: 4, clientId: 'parking-no-odo', vehicleId: 1, category: ExpenseCategory.Parking, totalPaid: 8, date: '2026-07-03' }],
        );

        expect(result.totalOwnershipExpenseCost).toBe(8);
        expect(result.trackedCost).toBe(8);
        expect(result.costPerKm).toBeNull();
        expect(result.provenance.includedSources).toEqual([{ category: 'parking', clientId: 'parking-no-odo', localId: 4 }]);
    });

    it('uses an expense odometer for the interval and excludes one before tracking or for another vehicle', () => {
        const result = calculateTrackedCost(
            { ...iceVehicle, currentOdometer: 10_000 },
            [],
            [],
            [],
            [
                { id: 5, clientId: 'eligible-tax', vehicleId: 1, category: ExpenseCategory.Tax, totalPaid: 50, date: '2026-07-03', odometer: 10_500 },
                { id: 6, clientId: 'before-tracking', vehicleId: 1, category: ExpenseCategory.Tolls, totalPaid: 10, date: '2026-07-03', odometer: 9_900 },
                { id: 7, clientId: 'other-vehicle', vehicleId: 2, category: ExpenseCategory.Parking, totalPaid: 5, date: '2026-07-03', odometer: 10_400 },
            ],
        );

        expect(result.interval.trackedDistance).toBe(500);
        expect(result.trackedCost).toBe(50);
        expect(result.costPerKm).toBe(0.1);
        expect(result.ownershipExpenses.map((entry) => entry.clientId)).toEqual(['eligible-tax']);
    });

    it('drops an ownership expense after deletion from the input projection', () => {
        const expense = { id: 8, clientId: 'deleted-expense', vehicleId: 1, category: ExpenseCategory.Other, totalPaid: 25, date: '2026-07-03', odometer: 10_100 };
        expect(calculateTrackedCost(iceVehicle, [], [], [], [expense]).trackedCost).toBe(25);
        expect(calculateTrackedCost(iceVehicle, [], [], [], []).trackedCost).toBe(0);
    });

    it('includes a date-only ownership expense on or after a known tracking start without blocking cost per km', () => {
        const vehicle = { ...iceVehicle, trackingStartDate: '2026-05-10' };
        const onStart = calculateTrackedCost(vehicle, [], [], [], [
            { id: 9, clientId: 'tax-on-start', vehicleId: 1, category: ExpenseCategory.Tax, totalPaid: 40, date: '2026-05-10' },
        ]);
        const afterStart = calculateTrackedCost(vehicle, [], [], [], [
            { id: 10, clientId: 'parking-after-start', vehicleId: 1, category: ExpenseCategory.Parking, totalPaid: 8, date: '2026-05-11' },
        ]);

        expect(onStart.trackedCost).toBe(40);
        expect(onStart.costPerKm).toBeCloseTo(40 / 3_000);
        expect(afterStart.trackedCost).toBe(8);
        expect(afterStart.costPerKm).toBeCloseTo(8 / 3_000);
    });

    it('excludes a date-only expense before a known tracking start date', () => {
        const result = calculateTrackedCost({ ...iceVehicle, trackingStartDate: '2026-05-10' }, [], [], [], [
            { id: 11, clientId: 'old-insurance', vehicleId: 1, category: ExpenseCategory.Insurance, totalPaid: 120, date: '2026-05-09' },
        ]);

        expect(result.trackedCost).toBe(0);
        expect(result.provenance.includedSources).toEqual([]);
    });

    it('keeps the conservative legacy result for an unanchored date-only expense', () => {
        const result = calculateTrackedCost(iceVehicle, [], [], [], [
            { id: 12, clientId: 'legacy-parking', vehicleId: 1, category: ExpenseCategory.Parking, totalPaid: 8, date: '2026-05-01' },
        ]);

        expect(result.trackedCost).toBe(8);
        expect(result.costPerKm).toBeNull();
    });

    it('keeps cost per km unavailable when the known-date interval has zero distance', () => {
        const result = calculateTrackedCost(
            { ...iceVehicle, currentOdometer: 10_000, trackingStartDate: '2026-05-10' },
            [],
            [],
            [],
            [{ id: 15, clientId: 'zero-distance-tax', vehicleId: 1, category: ExpenseCategory.Tax, totalPaid: 40, date: '2026-05-10' }],
        );

        expect(result.trackedCost).toBe(40);
        expect(result.interval.trackedDistance).toBe(0);
        expect(result.costPerKm).toBeNull();
    });

    it('requires an expense with both anchors to satisfy both dimensions', () => {
        const vehicle = { ...iceVehicle, currentOdometer: 10_000, trackingStartDate: '2026-05-10' };
        const result = calculateTrackedCost(vehicle, [], [], [], [
            { id: 13, clientId: 'contradictory-expense', vehicleId: 1, category: ExpenseCategory.Tolls, totalPaid: 10, date: '2026-05-09', odometer: 12_000 },
            { id: 14, clientId: 'matching-expense', vehicleId: 1, category: ExpenseCategory.Tolls, totalPaid: 12, date: '2026-05-10', odometer: 10_500 },
        ]);

        expect(result.ownershipExpenses.map((entry) => entry.clientId)).toEqual(['matching-expense']);
        expect(result.trackedCost).toBe(12);
        expect(result.interval.latestEligibleOdometer).toBe(10_500);
    });
});
