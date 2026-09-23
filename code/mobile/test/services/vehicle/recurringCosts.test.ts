import { describe, expect, it } from 'vitest';
import { ExpenseCategory } from '../../../src/models/ExpenseEntry';
import { calculateNormalizedRecurringCost, monthlyEquivalent } from '../../../src/services/vehicle/recurringCosts';
import { calculateTrackedCost } from '../../../src/services/vehicle/trackedCost';

const vehicle = { id: 1, clientId: 'vehicle-1', brand: 'Toyota', model: 'Corolla', year: 2022, ownershipStartMileage: 8_000, trackingStartMileage: 10_000, trackingStartDate: '2026-01-10', currentOdometer: 12_000 };
const schedule = (overrides = {}) => ({ id: 1, clientId: 'recurring-1', vehicleId: 1, category: ExpenseCategory.Insurance, amount: 480, periodMonths: 12 as const, startDate: '2026-01-01T00:00:00.000Z', active: true, ...overrides });

describe('normalized recurring ownership costs', () => {
    it.each([[1, 25, 25], [3, 150, 50], [6, 240, 40], [12, 480, 40]])(
        'calculates %s-month recurrence as EUR %s -> EUR %s/month',
        (periodMonths, amount, expected) => expect(monthlyEquivalent({ amount, periodMonths: periodMonths as 1 | 3 | 6 | 12 })).toBe(expected),
    );

    it('excludes invalid schedules and future schedules from normalized tracked cost', () => {
        const result = calculateNormalizedRecurringCost(vehicle, [
            schedule({ id: 1, amount: 0 }),
            schedule({ id: 2, periodMonths: 2 as never }),
            schedule({ id: 3, startDate: '2026-12-01T00:00:00.000Z' }),
        ], '2026-06-01');
        expect(result.monthlyEquivalent).toBe(0);
        expect(result.eligibleSchedules).toEqual([]);
    });

    it('includes an active schedule that began before tracking because the commitment overlaps tracking', () => {
        const result = calculateNormalizedRecurringCost(vehicle, [schedule({ startDate: '2025-01-01T00:00:00.000Z' })], '2026-06-01');
        expect(result.monthlyEquivalent).toBe(40);
        expect(result.eligibleSchedules).toHaveLength(1);
    });

    it('excludes schedules for another vehicle and inactive schedules', () => {
        const result = calculateNormalizedRecurringCost(vehicle, [
            schedule({ vehicleId: 2 }),
            schedule({ id: 2, active: false }),
            schedule({ id: 3, amount: 25, periodMonths: 1 }),
        ], '2026-06-01');
        expect(result.monthlyEquivalent).toBe(25);
        expect(result.eligibleSchedules.map((entry) => entry.id)).toEqual([3]);
    });

    it('returns unavailable normalized-period semantics for a legacy vehicle without a tracking date', () => {
        const result = calculateNormalizedRecurringCost({ ...vehicle, trackingStartDate: null }, [schedule()], '2026-06-01');
        expect(result).toMatchObject({ monthlyEquivalent: null, trackingPeriod: 'tracking-start-date-unknown', eligibleSchedules: [] });
    });

    it('keeps recurring schedules independent from transaction-based tracked cost', () => {
        const payment = { id: 4, clientId: 'payment-1', vehicleId: 1, category: ExpenseCategory.Insurance, totalPaid: 480, date: '2026-01-12' };
        const tracked = calculateTrackedCost(vehicle, [], [], [], [payment]);
        const normalized = calculateNormalizedRecurringCost(vehicle, [schedule()], '2026-06-01');

        expect(tracked.trackedCost).toBe(480);
        expect(normalized.monthlyEquivalent).toBe(40);
        expect(calculateTrackedCost(vehicle, [], [], [], []).trackedCost).toBe(0);
    });
});
