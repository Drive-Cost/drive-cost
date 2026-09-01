import type { SyncEntityType, SyncPayloadByEntity } from '../../domain/sync';

export interface LocalSyncMutationDependencies<Transaction> {
    withTransaction: (operation: (transaction: Transaction) => Promise<void>) => Promise<void>;
    enqueue: <EntityType extends SyncEntityType>(
        entityType: EntityType,
        payload: SyncPayloadByEntity[EntityType],
        createdAt: string,
        transaction: Transaction,
    ) => Promise<void>;
    triggerQueuedSync: () => Promise<void>;
    now: () => string;
}

export function createLocalSyncMutation<Transaction>(dependencies: LocalSyncMutationDependencies<Transaction>) {
    return {
        persistAndQueue: async <EntityType extends SyncEntityType>(
            entityType: EntityType,
            persist: (transaction: Transaction) => Promise<SyncPayloadByEntity[EntityType]>,
        ): Promise<void> => {
            await dependencies.withTransaction(async (transaction) => {
                const payload = await persist(transaction);
                await dependencies.enqueue(entityType, payload, dependencies.now(), transaction);
            });

            await dependencies.triggerQueuedSync();
        },
    };
}
