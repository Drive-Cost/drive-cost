import { describe, expect, it } from 'vitest';
import { FuelEntry, FuelFillStatus } from '../../../src/models/FuelEntry';
import { calculateFuelConsumption } from '../../../src/services/vehicle/fuelConsumption';

function entry(
    id: number,
    odometer: number,
    liters: number,
    fillStatus: FuelFillStatus,
): FuelEntry {
    return {
        id,
        clientId: `fuel-${id}`,
        vehicleId: 1,
        date: `2026-01-${String(id).padStart(2, '0')}`,
        odometer,
        liters,
        price: liters * 1.5,
        fillStatus,
    };
}

describe('calculateFuelConsumption', () => {
    it('is unavailable with only a first full-tank boundary', () => {
        const result = calculateFuelConsumption([entry(1, 100_000, 45, FuelFillStatus.Full)]);

        expect(result).toEqual({ intervals: [], latestInterval: null, aggregate: null });
    });

    it('measures two consecutive full fill-ups without including the starting fill amount', () => {
        const result = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 100_700, 35, FuelFillStatus.Full),
        ]);

        expect(result.latestInterval).toMatchObject({ distanceKm: 700, liters: 35, litersPer100Km: 5 });
        expect(result.latestInterval?.includedEntries).toEqual([{ clientId: 'fuel-2', localId: 2 }]);
    });

    it('includes partial fill-ups between full-tank boundaries', () => {
        const result = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 100_300, 20, FuelFillStatus.Partial),
            entry(3, 100_700, 35, FuelFillStatus.Full),
        ]);

        expect(result.latestInterval).toMatchObject({ distanceKm: 700, liters: 55, litersPer100Km: 55 / 7 });
        expect(result.latestInterval?.includedEntries).toEqual([
            { clientId: 'fuel-2', localId: 2 },
            { clientId: 'fuel-3', localId: 3 },
        ]);
    });

    it('includes multiple partial fill-ups in the same measured interval', () => {
        const result = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 100_200, 10, FuelFillStatus.Partial),
            entry(3, 100_400, 12, FuelFillStatus.Partial),
            entry(4, 100_700, 35, FuelFillStatus.Full),
        ]);

        expect(result.latestInterval).toMatchObject({ distanceKm: 700, liters: 57 });
        expect(result.latestInterval?.litersPer100Km).toBeCloseTo(57 / 7);
    });

    it('does not bridge an unknown fill status between full-tank boundaries', () => {
        const result = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 100_300, 20, FuelFillStatus.Unknown),
            entry(3, 100_700, 35, FuelFillStatus.Full),
        ]);

        expect(result).toEqual({ intervals: [], latestInterval: null, aggregate: null });
    });

    it('ignores unknown entries before the first full boundary and after the latest full boundary', () => {
        const result = calculateFuelConsumption([
            entry(1, 99_900, 10, FuelFillStatus.Unknown),
            entry(2, 100_000, 45, FuelFillStatus.Full),
            entry(3, 100_700, 35, FuelFillStatus.Full),
            entry(4, 100_800, 10, FuelFillStatus.Unknown),
        ]);

        expect(result.latestInterval).toMatchObject({ distanceKm: 700, liters: 35, litersPer100Km: 5 });
    });

    it('returns each valid interval, the latest one, and an aggregate for its compatible chain', () => {
        const result = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 100_100, 30, FuelFillStatus.Full),
            entry(3, 100_300, 40, FuelFillStatus.Full),
        ]);

        expect(result.intervals.map((interval) => interval.litersPer100Km)).toEqual([30, 20]);
        expect(result.latestInterval).toMatchObject({ distanceKm: 200, liters: 40, litersPer100Km: 20 });
        expect(result.aggregate).toEqual({ intervalCount: 2, distanceKm: 300, liters: 70, litersPer100Km: 70 / 3 });
    });

    it('does not aggregate across chains separated by an unknown entry', () => {
        const result = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 100_100, 30, FuelFillStatus.Full),
            entry(3, 100_200, 10, FuelFillStatus.Unknown),
            entry(4, 100_300, 40, FuelFillStatus.Full),
            entry(5, 100_500, 35, FuelFillStatus.Full),
        ]);

        expect(result.intervals).toHaveLength(2);
        expect(result.aggregate).toEqual({ intervalCount: 1, distanceKm: 200, liters: 35, litersPer100Km: 17.5 });
    });

    it('does not produce a measurement from zero or regressing odometer readings', () => {
        const zeroDistance = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 100_000, 35, FuelFillStatus.Full),
        ]);
        const regressing = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, 99_900, 20, FuelFillStatus.Partial),
            entry(3, 100_700, 35, FuelFillStatus.Full),
        ]);
        const invalid = calculateFuelConsumption([
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(2, Number.NaN, 20, FuelFillStatus.Partial),
            entry(3, 100_700, 35, FuelFillStatus.Full),
        ]);

        expect(zeroDistance.latestInterval).toBeNull();
        expect(regressing.latestInterval).toBeNull();
        expect(invalid.latestInterval).toBeNull();
    });

    it('recalculates after a partial fill-up is deleted', () => {
        const boundaries = [
            entry(1, 100_000, 45, FuelFillStatus.Full),
            entry(3, 100_700, 35, FuelFillStatus.Full),
        ];

        expect(calculateFuelConsumption([...boundaries.slice(0, 1), entry(2, 100_300, 20, FuelFillStatus.Partial), boundaries[1]]).latestInterval)
            .toMatchObject({ liters: 55 });
        expect(calculateFuelConsumption(boundaries).latestInterval).toMatchObject({ liters: 35 });
    });

    it('recalculates boundaries when entries are edited between partial, unknown, and full', () => {
        const start = entry(1, 100_000, 45, FuelFillStatus.Full);
        const middle = entry(2, 100_300, 20, FuelFillStatus.Partial);
        const end = entry(3, 100_700, 35, FuelFillStatus.Full);

        expect(calculateFuelConsumption([start, middle, end]).intervals).toHaveLength(1);
        expect(calculateFuelConsumption([start, { ...middle, fillStatus: FuelFillStatus.Full }, end]).intervals).toHaveLength(2);

        const unknownMiddle = { ...middle, fillStatus: FuelFillStatus.Unknown };
        expect(calculateFuelConsumption([start, unknownMiddle, end]).intervals).toHaveLength(0);
        expect(calculateFuelConsumption([start, { ...unknownMiddle, fillStatus: FuelFillStatus.Full }, end]).intervals).toHaveLength(2);

        const consecutiveFulls = [start, { ...middle, fillStatus: FuelFillStatus.Full }, end];
        expect(calculateFuelConsumption(consecutiveFulls).intervals).toHaveLength(2);
        expect(calculateFuelConsumption([start, middle, end]).latestInterval).toMatchObject({ liters: 55 });
    });
});
