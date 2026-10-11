import assert from 'node:assert/strict';
import test from 'node:test';
import { createVehicleService } from '../../../src/modules/vehicles/service';
import { HttpProblem } from '../../../src/platform/http/problemDetails';

test('vehicle service rejects conflicting mileage anchors before writing', () => {
    let writes = 0;
    const service = createVehicleService({
        listEntities: async () => [],
        upsertEntity: async () => {
            writes += 1;
            return null;
        },
        deleteVehicle: async () => {},
        entityExists: async () => false,
        entityIsDeleted: async () => false,
    });
    const input = {
        clientId: 'vehicle_1',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2022,
        ownershipStartMileage: 100,
        trackingStartMileage: 200,
        currentOdometer: 300,
    };
    for (const invalid of [
        { ...input, trackingStartMileage: 50 },
        { ...input, currentOdometer: 150 },
    ]) {
        assert.throws(
            () => service.upsert('user_1', invalid),
            (error: unknown) => error instanceof HttpProblem && error.definition.status === 422,
        );
    }
    assert.equal(writes, 0);
});

test('vehicle availability is user scoped and distinguishes active, deleted, and missing records', async () => {
    const calls: string[] = [];
    const service = createVehicleService({
        listEntities: async () => [],
        upsertEntity: async () => null,
        deleteVehicle: async () => {},
        entityExists: async (userId, entityType, clientId) => {
            calls.push(`${userId}:${entityType}:${clientId}`);
            return clientId === 'active';
        },
        entityIsDeleted: async (_userId, _entityType, clientId) => clientId === 'deleted',
    });
    assert.equal(await service.availability('user_1', 'active'), 'active');
    assert.equal(await service.availability('user_1', 'deleted'), 'deleted');
    assert.equal(await service.availability('user_1', 'missing'), 'missing');
    assert.deepEqual(calls, ['user_1:vehicle:active', 'user_1:vehicle:deleted', 'user_1:vehicle:missing']);
});
