import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({ openDatabaseSync: () => ({}) }));

import { addVehicle, updateVehicle, upsertVehicleFromSync } from '../../src/database/vehicleRepository';

const vehicle = {
    id: 7,
    clientId: 'vehicle-client-7',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    ownershipStartMileage: 8_000,
    trackingStartMileage: 10_000,
    trackingStartDate: '2026-09-06',
    currentOdometer: 12_000,
};

describe('vehicle tracking-date persistence', () => {
    it('persists an explicit tracking date without changing the existing identity or vehicle data', async () => {
        const commands: Array<{ sql: string; params: unknown[] }> = [];
        const database = { runAsync: async (sql: string, ...params: unknown[]) => { commands.push({ sql, params }); } };

        await addVehicle(vehicle, database as never);
        await updateVehicle({ ...vehicle, trackingStartDate: '2026-09-07' }, database as never);
        await upsertVehicleFromSync({ ...vehicle, trackingStartDate: null }, database as never);

        expect(commands[0].params).toContain('vehicle-client-7');
        expect(commands[0].params).toContain('2026-09-06');
        expect(commands[1].params).toContain('2026-09-07');
        expect(commands[2].params).toContain(null);
    });
});
