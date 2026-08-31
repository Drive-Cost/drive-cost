import { enqueueSyncJob } from '../../database/syncRepository';
import { SyncEntityType, SyncPayloadByEntity } from '../../domain/sync';
import { processSyncQueue } from './syncService';

export async function queueSyncJob<EntityType extends SyncEntityType>(
    entityType: EntityType,
    payload: SyncPayloadByEntity[EntityType],
) {
    await enqueueSyncJob({ entityType, payload: JSON.stringify(payload), createdAt: new Date().toISOString() });

    try {
        await processSyncQueue();
    } catch {
        // Offline or backend unavailable is expected; the queue remains local.
    }
}
