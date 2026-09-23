import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({ openDatabaseSync: () => ({}) }));

import { deleteVehicleById } from '../../src/database/vehicleRepository';

describe('vehicle deletion persistence', () => {
    it('deletes only the vehicle row after resolving its durable sync identity', async () => {
        const commands: Array<{ sql: string; params: unknown[] }> = [];
        const database = {
            getFirstAsync: vi.fn().mockResolvedValue({ clientId: 'vehicle-a' }),
            runAsync: async (sql: string, ...params: unknown[]) => {
                commands.push({ sql, params });
                return { changes: 1 };
            },
        };

        await expect(deleteVehicleById(41, database as never)).resolves.toBe('vehicle-a');
        expect(commands).toEqual([{ sql: 'DELETE FROM vehicles WHERE id = ?', params: [41] }]);
    });

    it('keeps data intact when the target vehicle no longer exists', async () => {
        const database = { getFirstAsync: vi.fn().mockResolvedValue(null), runAsync: vi.fn() };

        await expect(deleteVehicleById(41, database as never)).rejects.toThrow('Vehicle could not be deleted');
        expect(database.runAsync).not.toHaveBeenCalled();
    });
});
