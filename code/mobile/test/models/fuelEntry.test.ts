import { describe, expect, it } from 'vitest';
import { FuelFillStatus, normalizeFuelEntry } from '../../src/models/FuelEntry';

describe('normalizeFuelEntry', () => {
    it('treats a legacy local record with no fill status as unknown without changing its identity or transaction data', () => {
        const legacyEntry = {
            id: 7,
            clientId: 'legacy-fuel-7',
            vehicleId: 2,
            date: '2026-03-01T00:00:00.000Z',
            liters: 42.5,
            price: 73.2,
            odometer: 20_500,
        };

        expect(normalizeFuelEntry(legacyEntry)).toEqual({ ...legacyEntry, fillStatus: FuelFillStatus.Unknown });
    });
});
