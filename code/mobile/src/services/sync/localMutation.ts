import type { SyncEntityType, SyncOperationByEntity, SyncPayloadByOperation } from '../../domain/sync';

export interface LocalSyncMutationDependencies<Transaction> {
    withTransaction: (operation: (transaction: Transaction) => Promise<void>) => Promise<void>;
    enqueue: <EntityType extends SyncEntityType, Operation extends SyncOperationByEntity[EntityType]>(
        entityType: EntityType,
        operation: Operation,
        payload: SyncPayloadByOperation<EntityType, Operation>,
        createdAt: string,
        transaction: Transaction,
    ) => Promise<void>;
    triggerQueuedSync: () => Promise<void>;
    now: () => string;
}

export function createLocalSyncMutation<Transaction>(dependencies: LocalSyncMutationDependencies<Transaction>) {
    return {
        persistAndQueue: async <EntityType extends SyncEntityType, Operation extends SyncOperationByEntity[EntityType]>(
            entityType: EntityType,
            operation: Operation,
            persist: (
                transaction: Transaction,
            ) => Promise<SyncPayloadByOperation<EntityType, Operation>>,
        ): Promise<void> => {
            await dependencies.withTransaction(async (transaction) => {
                const payload = await persist(transaction);
                await dependencies.enqueue(entityType, operation, payload, dependencies.now(), transaction);
            });

            await dependencies.triggerQueuedSync();
        },
    };
}
