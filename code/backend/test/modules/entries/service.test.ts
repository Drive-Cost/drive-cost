import assert from 'node:assert/strict';
import test from 'node:test';
import { SyncEntity } from '@drivecost/contracts';
import { createEntryService } from '../../../src/modules/entries/service';
import { HttpProblem } from '../../../src/platform/http/problemDetails';

const input = {
    clientId: 'charge_1',
    vehicleClientId: 'vehicle_1',
    date: '2026-10-09T12:00:00.000Z',
    kWh: 20,
    price: 10,
    odometer: 300,
};

test('entry service verifies the parent through the vehicle service before accepting a write', async () => {
    const calls: unknown[][] = [];
    const service = createEntryService(
        {
            upsertEntity: async (...args) => {
                calls.push(args);
                return null;
            },
            deleteEntity: async () => {},
        },
        {
            availability: async (userId, clientId) => {
                assert.equal(userId, 'user_1');
                assert.equal(clientId, input.vehicleClientId);
                return 'active';
            },
        },
    );
    await service.upsert('user_1', SyncEntity.ChargingEntry, input);
    assert.deepEqual(calls, [['user_1', SyncEntity.ChargingEntry, input]]);
});

test('missing and deleted parents cannot create entries; deleted parents remain replay safe', async () => {
    let writes = 0;
    for (const availability of ['missing', 'deleted'] as const) {
        const service = createEntryService(
            {
                upsertEntity: async () => {
                    writes += 1;
                    return null;
                },
                deleteEntity: async () => {},
            },
            { availability: async () => availability },
        );
        if (availability === 'missing') {
            await assert.rejects(
                service.upsert('user_1', SyncEntity.ChargingEntry, input),
                (error: unknown) => error instanceof HttpProblem && error.definition.status === 409,
            );
        } else {
            assert.equal(await service.upsert('user_1', SyncEntity.ChargingEntry, input), null);
        }
    }
    assert.equal(writes, 0);
});
