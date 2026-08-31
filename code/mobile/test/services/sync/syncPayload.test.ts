import { describe, expect, it } from 'vitest';
import { toVehicleSyncPayload } from '../../../src/services/sync/syncPayload';

describe('toVehicleSyncPayload', () => {
    it('Given a persisted vehicle, when preparing it for sync, then excludes device-only fields', () => {
        const payload = toVehicleSyncPayload({
            id: 42,
            clientId: 'vehicle-1',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2022,
            ownershipStartMileage: 12_000,
            trackingStartMileage: 15_000,
            currentOdometer: 18_000,
            currentMileage: 18_000,
        });

        expect(payload).toEqual({
            clientId: 'vehicle-1',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2022,
            ownershipStartMileage: 12_000,
            trackingStartMileage: 15_000,
            currentOdometer: 18_000,
        });
    });

    it('Given a vehicle without a client ID, when preparing it for sync, then rejects it', () => {
        expect(() =>
            toVehicleSyncPayload({
                brand: 'Toyota',
                model: 'Corolla',
                year: 2022,
                ownershipStartMileage: 12_000,
                trackingStartMileage: 15_000,
                currentOdometer: 18_000,
            }),
        ).toThrow('Cannot sync a vehicle without a client ID.');
    });
});
