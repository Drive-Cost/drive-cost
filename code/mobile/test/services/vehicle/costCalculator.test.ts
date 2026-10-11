import { describe, expect, it } from 'vitest';
import {
    calculateCostPerKm,
    calculateTotalEnergyCost,
    calculateTotalMaintenanceCost,
    formatCostPerKm,
} from '../../../src/services/vehicle/costCalculator';

describe('ownership cost calculations', () => {
    it('sums fuel and maintenance independently without requiring persistence identity', () => {
        expect(calculateTotalEnergyCost([{ amount: 68 }, { amount: 61.5 }])).toBe(129.5);
        expect(calculateTotalMaintenanceCost([{ cost: 220 }])).toBe(220);
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
