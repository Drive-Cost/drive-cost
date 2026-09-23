import { describe, expect, it } from 'vitest';
import {
    calculateCostPerKm,
    calculateTotalEnergyCost,
    calculateTotalMaintenanceCost,
    formatCostPerKm,
} from '../../../src/services/vehicle/costCalculator';

describe('ownership cost calculations', () => {
    it('sums fuel and maintenance independently', () => {
        expect(
            calculateTotalEnergyCost([
                {
                    vehicleId: 1,
                    date: '2026-01-01',
                    quantity: 40,
                    amount: 68,
                    odometer: 12000,
                    source: 'fuel',
                },
                {
                    vehicleId: 1,
                    date: '2026-01-15',
                    quantity: 35,
                    amount: 61.5,
                    odometer: 12600,
                    source: 'fuel',
                },
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

    it('returns an unavailable cost per km when distance is not positive', () => {
        expect(calculateCostPerKm(120, 0)).toBeNull();
        expect(calculateCostPerKm(120, -1)).toBeNull();
        expect(calculateCostPerKm(120, Number.NaN)).toBeNull();
        expect(formatCostPerKm(calculateCostPerKm(120, 0))).toBe('Unavailable');
        expect(calculateCostPerKm(120, 600)).toBe(0.2);
    });

    it('keeps zero cost per km valid when distance is positive', () => {
        expect(calculateCostPerKm(0, 600)).toBe(0);
    });
});
