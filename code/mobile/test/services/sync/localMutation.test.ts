import { describe, expect, it } from 'vitest';
import { SyncEntity, VehicleSyncPayload } from '../../../src/domain/sync';
import { createLocalSyncMutation } from '../../../src/services/sync/localMutation';

interface MemoryTransaction {
    readonly replica: MemoryReplica;
}

interface MemoryReplica {
    writes: string[];
    jobs: Array<{ entityType: string; clientId: string; createdAt: string }>;
    events: string[];
}

const CREATED_AT = '2026-09-01T12:00:00.000Z';

describe('createLocalSyncMutation', () => {
    it('Given a local vehicle write, when the transaction commits, then it persists the write and outbox job before sync starts', async () => {
        const replica = createReplica();
        const mutation = createMutation(replica);

        await mutation.persistAndQueue(SyncEntity.Vehicle, async (transaction) => {
            transaction.replica.events.push('persist');
            transaction.replica.writes.push('vehicle-1');
            return vehiclePayload('vehicle-1');
        });

        expect(replica.writes).toEqual(['vehicle-1']);
        expect(replica.jobs).toEqual([{ entityType: SyncEntity.Vehicle, clientId: 'vehicle-1', createdAt: CREATED_AT }]);
        expect(replica.events).toEqual(['begin', 'persist', 'enqueue', 'commit', 'trigger-sync']);
    });

    it('Given outbox persistence fails, when the transaction rolls back, then it keeps neither the local write nor a queued sync', async () => {
        const replica = createReplica();
        const mutation = createMutation(replica, { failEnqueue: true });

        await expect(
            mutation.persistAndQueue(SyncEntity.Vehicle, async (transaction) => {
                transaction.replica.events.push('persist');
                transaction.replica.writes.push('vehicle-1');
                return vehiclePayload('vehicle-1');
            }),
        ).rejects.toThrow('Outbox unavailable.');

        expect(replica.writes).toEqual([]);
        expect(replica.jobs).toEqual([]);
        expect(replica.events).toEqual(['begin', 'persist', 'enqueue', 'rollback']);
    });

    it('Given the local write fails, when the transaction rolls back, then it never queues or triggers sync', async () => {
        const replica = createReplica();
        const mutation = createMutation(replica);

        await expect(
            mutation.persistAndQueue(SyncEntity.Vehicle, async () => {
                throw new Error('Vehicle write failed.');
            }),
        ).rejects.toThrow('Vehicle write failed.');

        expect(replica.writes).toEqual([]);
        expect(replica.jobs).toEqual([]);
        expect(replica.events).toEqual(['begin', 'rollback']);
    });
});

function createMutation(replica: MemoryReplica, options: { failEnqueue?: boolean } = {}) {
    return createLocalSyncMutation<MemoryTransaction>({
        withTransaction: async (operation) => {
            const writes = [...replica.writes];
            const jobs = [...replica.jobs];
            replica.events.push('begin');

            try {
                await operation({ replica });
                replica.events.push('commit');
            } catch (error) {
                replica.writes = writes;
                replica.jobs = jobs;
                replica.events.push('rollback');
                throw error;
            }
        },
        enqueue: async (entityType, payload, createdAt, transaction) => {
            transaction.replica.events.push('enqueue');
            if (options.failEnqueue) {
                throw new Error('Outbox unavailable.');
            }
            transaction.replica.jobs.push({ entityType, clientId: payload.clientId, createdAt });
        },
        triggerQueuedSync: async () => {
            replica.events.push('trigger-sync');
        },
        now: () => CREATED_AT,
    });
}

function createReplica(): MemoryReplica {
    return { writes: [], jobs: [], events: [] };
}

function vehiclePayload(clientId: string): VehicleSyncPayload {
    return {
        clientId,
        brand: 'Toyota',
        model: 'Corolla',
        year: 2022,
        ownershipStartMileage: 8_000,
        trackingStartMileage: 9_000,
        currentOdometer: 10_000,
    };
}
