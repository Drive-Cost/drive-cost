import { describe, expect, it } from 'vitest';
import { SyncEntity, SyncOperation, VehicleSyncPayload } from '../../../src/domain/sync';
import { createLocalSyncMutation } from '../../../src/services/sync/localMutation';

type MemoryTransaction = {
  readonly replica: MemoryReplica;
};

type MemoryReplica = {
  writes: string[];
  jobs: Array<{ entityType: string; operation: string; clientId: string; createdAt: string }>;
  events: string[];
};

const CREATED_AT = '2026-09-01T12:00:00.000Z';

describe('createLocalSyncMutation', () => {
  it('finishes a committed single-job mutation without waiting for its sync request', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica, { triggerSync: () => new Promise<void>(() => {}) });
    await mutation.persistAndQueue(SyncEntity.Vehicle, SyncOperation.Upsert, async transaction => {
      transaction.replica.writes.push('vehicle-1');
      return vehiclePayload('vehicle-1');
    });
    expect(replica.writes).toEqual(['vehicle-1']);
    expect(replica.jobs).toHaveLength(1);
    expect(replica.events.at(-1)).toBe('commit');
  });

  it('keeps a committed mutation successful if scheduling itself throws', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica, {
      triggerSync: () => {
        throw new Error('Scheduler unavailable.');
      },
    });
    await mutation.persistAndQueue(SyncEntity.Vehicle, SyncOperation.Upsert, async transaction => {
      transaction.replica.writes.push('vehicle-1');
      return vehiclePayload('vehicle-1');
    });
    expect(replica.writes).toEqual(['vehicle-1']);
    expect(replica.jobs).toHaveLength(1);
  });

  it('returns the typed local result only after a multi-job transaction commits', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica);
    const saved = await mutation.persistBatch(async (transaction, queue) => {
      transaction.replica.writes.push('vehicle-1', 'fuel-1');
      await queue(SyncEntity.Vehicle, SyncOperation.Upsert, vehiclePayload('vehicle-1'));
      await queue(SyncEntity.FuelEntry, SyncOperation.Delete, { clientId: 'fuel-1' });
      return { id: 7, clientId: 'fuel-1' };
    });
    expect(saved).toEqual({ id: 7, clientId: 'fuel-1' });
    expect(replica.events).toEqual(['begin', 'enqueue', 'enqueue', 'commit', 'trigger-sync']);
    expect(replica.jobs.map(job => job.createdAt)).toEqual([CREATED_AT, CREATED_AT]);
  });
  it('Given a local vehicle write, when the transaction commits, then it persists the write and outbox job before sync starts', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica);

    await mutation.persistAndQueue(SyncEntity.Vehicle, SyncOperation.Upsert, async transaction => {
      transaction.replica.events.push('persist');
      transaction.replica.writes.push('vehicle-1');
      return vehiclePayload('vehicle-1');
    });

    expect(replica.writes).toEqual(['vehicle-1']);
    expect(replica.jobs).toEqual([
      { entityType: SyncEntity.Vehicle, operation: SyncOperation.Upsert, clientId: 'vehicle-1', createdAt: CREATED_AT },
    ]);
    expect(replica.events).toEqual(['begin', 'persist', 'enqueue', 'commit', 'trigger-sync']);
  });

  it('Given outbox persistence fails, when the transaction rolls back, then it keeps neither the local write nor a queued sync', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica, { failEnqueue: true });

    await expect(
      mutation.persistAndQueue(SyncEntity.Vehicle, SyncOperation.Upsert, async transaction => {
        transaction.replica.events.push('persist');
        transaction.replica.writes.push('vehicle-1');
        return vehiclePayload('vehicle-1');
      })
    ).rejects.toThrow('Outbox unavailable.');

    expect(replica.writes).toEqual([]);
    expect(replica.jobs).toEqual([]);
    expect(replica.events).toEqual(['begin', 'persist', 'enqueue', 'rollback']);
  });

  it('Given the local write fails, when the transaction rolls back, then it never queues or triggers sync', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica);

    await expect(
      mutation.persistAndQueue(SyncEntity.Vehicle, SyncOperation.Upsert, async () => {
        throw new Error('Vehicle write failed.');
      })
    ).rejects.toThrow('Vehicle write failed.');

    expect(replica.writes).toEqual([]);
    expect(replica.jobs).toEqual([]);
    expect(replica.events).toEqual(['begin', 'rollback']);
  });

  it('Given a deleted fuel entry, when the transaction commits, then it queues an idempotent delete payload', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica);

    await mutation.persistAndQueue(SyncEntity.FuelEntry, SyncOperation.Delete, async transaction => {
      transaction.replica.events.push('delete');
      transaction.replica.writes.push('fuel-entry-1');
      return { clientId: 'fuel-entry-1' };
    });

    expect(replica.writes).toEqual(['fuel-entry-1']);
    expect(replica.jobs).toEqual([
      {
        entityType: SyncEntity.FuelEntry,
        operation: SyncOperation.Delete,
        clientId: 'fuel-entry-1',
        createdAt: CREATED_AT,
      },
    ]);
    expect(replica.events).toEqual(['begin', 'delete', 'enqueue', 'commit', 'trigger-sync']);
  });

  it('Given recurring schedule create, edit, activation changes, and deletion, when each transaction commits, then it queues the matching idempotent operation', async () => {
    const replica = createReplica();
    const mutation = createMutation(replica);

    for (const [action, active] of [
      ['create', true],
      ['edit', true],
      ['deactivate', false],
      ['reactivate', true],
    ] as const) {
      await mutation.persistAndQueue(SyncEntity.RecurringExpense, SyncOperation.Upsert, async transaction => {
        transaction.replica.events.push(action);
        transaction.replica.writes.push('recurring-entry-1');
        return {
          clientId: 'recurring-entry-1',
          vehicleClientId: 'vehicle-1',
          category: 'insurance',
          amount: 480,
          periodMonths: 12,
          startDate: '2026-01-01T00:00:00.000Z',
          active,
        };
      });
    }
    await mutation.persistAndQueue(SyncEntity.RecurringExpense, SyncOperation.Delete, async transaction => {
      transaction.replica.events.push('delete');
      transaction.replica.writes.push('recurring-entry-1');
      return { clientId: 'recurring-entry-1' };
    });

    expect(replica.jobs).toEqual([
      {
        entityType: SyncEntity.RecurringExpense,
        operation: SyncOperation.Upsert,
        clientId: 'recurring-entry-1',
        createdAt: CREATED_AT,
      },
      {
        entityType: SyncEntity.RecurringExpense,
        operation: SyncOperation.Upsert,
        clientId: 'recurring-entry-1',
        createdAt: CREATED_AT,
      },
      {
        entityType: SyncEntity.RecurringExpense,
        operation: SyncOperation.Upsert,
        clientId: 'recurring-entry-1',
        createdAt: CREATED_AT,
      },
      {
        entityType: SyncEntity.RecurringExpense,
        operation: SyncOperation.Upsert,
        clientId: 'recurring-entry-1',
        createdAt: CREATED_AT,
      },
      {
        entityType: SyncEntity.RecurringExpense,
        operation: SyncOperation.Delete,
        clientId: 'recurring-entry-1',
        createdAt: CREATED_AT,
      },
    ]);
    expect(replica.events).toEqual([
      'begin',
      'create',
      'enqueue',
      'commit',
      'trigger-sync',
      'begin',
      'edit',
      'enqueue',
      'commit',
      'trigger-sync',
      'begin',
      'deactivate',
      'enqueue',
      'commit',
      'trigger-sync',
      'begin',
      'reactivate',
      'enqueue',
      'commit',
      'trigger-sync',
      'begin',
      'delete',
      'enqueue',
      'commit',
      'trigger-sync',
    ]);
  });
});

function createMutation(
  replica: MemoryReplica,
  options: { failEnqueue?: boolean; triggerSync?: () => Promise<void> } = {}
) {
  return createLocalSyncMutation<MemoryTransaction>({
    withTransaction: async operation => {
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
    enqueue: async (entityType, operation, payload, createdAt, transaction) => {
      transaction.replica.events.push('enqueue');
      if (options.failEnqueue) {
        throw new Error('Outbox unavailable.');
      }
      transaction.replica.jobs.push({ entityType, operation, clientId: payload.clientId, createdAt });
    },
    triggerQueuedSync:
      options.triggerSync ??
      (async () => {
        replica.events.push('trigger-sync');
      }),
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
