import { describe, expect, it } from 'vitest';
import { buildVehicleHistory } from '../../../src/services/vehicle/vehicleHistory';
import { FuelFillStatus } from '../../../src/models/FuelEntry';
import { ExpenseCategory } from '../../../src/models/ExpenseEntry';

const vehicle = {
    id: 1,
    clientId: 'vehicle-1',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    ownershipStartMileage: 8_000,
    trackingStartMileage: 9_000,
    currentOdometer: 12_000,
};

describe('buildVehicleHistory', () => {
    it('Given mixed vehicle entries, when building history, then returns every event newest first', () => {
        const history = buildVehicleHistory(
            vehicle,
            [
                {
                    id: 1,
                    clientId: 'fuel-1',
                    vehicleId: 1,
                    date: '2026-09-01T00:00:00.000Z',
                    liters: 40,
                    price: 70,
                    odometer: 11_000,
                    fillStatus: FuelFillStatus.Unknown,
                },
                {
                    id: 2,
                    clientId: 'fuel-2',
                    vehicleId: 1,
                    date: '2026-07-01T00:00:00.000Z',
                    liters: 38,
                    price: 68,
                    odometer: 10_000,
                    fillStatus: FuelFillStatus.Unknown,
                },
            ],
            [
                {
                    id: 3,
                    clientId: 'maintenance-1',
                    vehicleId: 1,
                    type: 'Oil service',
                    description: 'Oil and filter replacement',
                    cost: 95,
                    date: '2026-08-01T00:00:00.000Z',
                    odometer: 10_500,
                },
            ],
        );

        expect(history.map((event) => event.id)).toEqual(['fuel-1', 'maintenance-3', 'fuel-2']);
        expect(history).toHaveLength(3);
        expect(history[1]).toMatchObject({ title: 'Oil service', amount: 95 });
    });

    it('includes ownership expenses only for the current vehicle and reflects edits or deletion in the input projection', () => {
        const expense = { id: 4, clientId: 'expense-1', vehicleId: 1, category: ExpenseCategory.Insurance, totalPaid: 250, description: 'Policy renewal', date: '2026-10-01', odometer: undefined };
        const otherVehicleExpense = { id: 5, clientId: 'expense-2', vehicleId: 2, category: ExpenseCategory.Parking, totalPaid: 10, date: '2026-11-01' };
        const history = buildVehicleHistory(vehicle, [], [], [], [expense, otherVehicleExpense]);

        expect(history).toEqual([expect.objectContaining({ id: 'expense-4', title: 'Insurance', amount: 250, detail: 'Policy renewal' })]);
        expect(buildVehicleHistory(vehicle, [], [], [], [{ ...expense, category: ExpenseCategory.Tax, totalPaid: 260 }])[0])
            .toMatchObject({ title: 'Vehicle tax', amount: 260 });
        expect(buildVehicleHistory(vehicle, [], [], [], [])).toEqual([]);
    });
});
