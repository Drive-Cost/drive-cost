import * as SQLite from 'expo-sqlite';
import { db } from '../../database/db';
import { enqueueSyncJob } from '../../database/syncRepository';
import { processSyncQueue } from './syncService';
import { createLocalSyncMutation } from './localMutation';

const localSyncMutation = createLocalSyncMutation<SQLite.SQLiteDatabase>({
    withTransaction: (operation) => db.withExclusiveTransactionAsync(operation),
    enqueue: async (entityType, payload, createdAt, transaction) => {
        await enqueueSyncJob({ entityType, payload: JSON.stringify(payload), createdAt }, transaction);
    },
    triggerQueuedSync: requestQueuedSync,
    now: () => new Date().toISOString(),
});

export const persistAndQueueSync = localSyncMutation.persistAndQueue;

async function requestQueuedSync(): Promise<void> {
    try {
        await processSyncQueue();
    } catch {
        // Offline or backend unavailable is expected; the queue remains local.
    }
}
