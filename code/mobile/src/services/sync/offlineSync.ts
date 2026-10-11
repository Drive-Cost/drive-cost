import * as SQLite from 'expo-sqlite';
import { db } from '../../database/db';
import { enqueueSyncJob } from '../../database/syncRepository';
import { processSyncQueue } from './syncService';
import { createLocalSyncMutation } from './localMutation';

const localSyncMutation = createLocalSyncMutation<SQLite.SQLiteDatabase>({
  withTransaction: operation => db.withExclusiveTransactionAsync(operation),
  enqueue: async (entityType, operation, payload, createdAt, transaction) => {
    await enqueueSyncJob({ entityType, operation, payload: JSON.stringify(payload), createdAt }, transaction);
  },
  triggerQueuedSync: processSyncQueue,
  now: () => new Date().toISOString(),
});

export const persistAndQueueSync = localSyncMutation.persistAndQueue;
export const persistAndQueueSyncBatch = localSyncMutation.persistBatch;
