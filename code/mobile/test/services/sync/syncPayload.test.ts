import { describe, expect, it } from 'vitest';
import {
    toFuelEntrySyncPayload,
    toMaintenanceEntrySyncPayload,
    toVehicleSyncPayload,
} from '../../../src/services/sync/syncPayload';

const VEHICLE_CLIENT_ID = 'vehicle-client-1';

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

describe('entry sync payloads', () => {
    it('Given edited entries, when creating sync payloads, then preserves their client-owned identities', () => {
        expect(
            toFuelEntrySyncPayload(
                {
                    id: 41,
                    clientId: 'fuel-client-1',
                    vehicleId: 7,
                    date: '2026-09-02T12:00:00.000Z',
                    liters: 40.5,
                    price: 73.2,
                    odometer: 20_500,
                },
                VEHICLE_CLIENT_ID,
            ),
        ).toMatchObject({ clientId: 'fuel-client-1', vehicleClientId: VEHICLE_CLIENT_ID, liters: 40.5 });

        expect(
            toMaintenanceEntrySyncPayload(
                {
                    id: 42,
                    clientId: 'maintenance-client-1',
                    vehicleId: 7,
                    type: 'Oil service',
                    description: 'Oil and filter replacement',
                    cost: 95,
                    date: '2026-09-02T13:00:00.000Z',
                    odometer: 20_600,
                },
                VEHICLE_CLIENT_ID,
            ),
        ).toMatchObject({ clientId: 'maintenance-client-1', vehicleClientId: VEHICLE_CLIENT_ID, cost: 95 });
    });
});
