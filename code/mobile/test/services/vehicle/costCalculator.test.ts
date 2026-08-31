import { describe, expect, it } from 'vitest';
import {
    calculateCostPerKm,
    calculateTotalFuelCost,
    calculateTotalMaintenanceCost,
} from '../../../src/services/vehicle/costCalculator';

describe('ownership cost calculations', () => {
    it('sums fuel and maintenance independently', () => {
        expect(
            calculateTotalFuelCost([
                { vehicleId: 1, date: '2026-01-01', liters: 40, price: 68, odometer: 12000 },
                { vehicleId: 1, date: '2026-01-15', liters: 35, price: 61.5, odometer: 12600 },
            ]),
        ).toBe(129.5);

        expect(
            calculateTotalMaintenanceCost([
                {
                    vehicleId: 1,
                    type: 'Service',
                    description: 'Annual service',
                    cost: 220,
                    date: '2026-02-01',
                    odometer: 13000,
                },
            ]),
        ).toBe(220);
    });

    it('returns zero cost per km when no distance has been tracked', () => {
        expect(calculateCostPerKm(120, 0)).toBe(0);
        expect(calculateCostPerKm(120, 600)).toBe(0.2);
    });
});
