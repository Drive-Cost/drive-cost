import type { SyncEntityType, SyncOperationByEntity, SyncPayloadByOperation } from '../../domain/sync';

export type LocalSyncMutationDependencies<Transaction> = {
  withTransaction: (operation: (transaction: Transaction) => Promise<void>) => Promise<void>;
  enqueue: <EntityType extends SyncEntityType, Operation extends SyncOperationByEntity[EntityType]>(
    entityType: EntityType,
    operation: Operation,
    payload: SyncPayloadByOperation<EntityType, Operation>,
    createdAt: string,
    transaction: Transaction
  ) => Promise<void>;
  triggerQueuedSync: () => Promise<void>;
  now: () => string;
};

export type QueueSyncMutation = <
  EntityType extends SyncEntityType,
  Operation extends SyncOperationByEntity[EntityType],
>(
  entityType: EntityType,
  operation: Operation,
  payload: SyncPayloadByOperation<EntityType, Operation>
) => Promise<void>;

export type PersistSyncBatch<Transaction> = <Result>(
  persist: (transaction: Transaction, queue: QueueSyncMutation) => Promise<Result>
) => Promise<Result>;

export function createLocalSyncMutation<Transaction>(dependencies: LocalSyncMutationDependencies<Transaction>) {
  async function persistBatch<Result>(
    persist: (transaction: Transaction, queue: QueueSyncMutation) => Promise<Result>
  ): Promise<Result> {
    let committed: { value: Result } | undefined;
    await dependencies.withTransaction(async transaction => {
      const createdAt = dependencies.now();
      const queue: QueueSyncMutation = (entityType, operation, payload) =>
        dependencies.enqueue(entityType, operation, payload, createdAt, transaction);
      committed = { value: await persist(transaction, queue) };
    });
    if (!committed) throw new Error('The local transaction did not run.');

    // The outbox is durable. A failed or slow wake-up must never invalidate a local save.
    try {
      void dependencies.triggerQueuedSync().catch(() => undefined);
    } catch {
      // A later sync or app restart will pick up the committed jobs.
    }
    return committed.value;
  }
  return {
    persistBatch,
    persistAndQueue: async <EntityType extends SyncEntityType, Operation extends SyncOperationByEntity[EntityType]>(
      entityType: EntityType,
      operation: Operation,
      persist: (transaction: Transaction) => Promise<SyncPayloadByOperation<EntityType, Operation>>
    ): Promise<void> => {
      await persistBatch(async (transaction, queue) => {
        const payload = await persist(transaction);
        await queue(entityType, operation, payload);
      });
    },
  };
}
