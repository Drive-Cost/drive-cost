import { getDatasetGeneration, assertDatasetCurrent } from '../app/datasetContext';
import { readDeletionIntent } from '../../database/accountDeletionRepository';
import * as SQLite from 'expo-sqlite';
import { db } from '../../database/db';
import { enqueueSyncJob } from '../../database/syncRepository';
import { processSyncQueue } from './syncService';
import { createLocalSyncMutation } from './localMutation';

const localSyncMutation = createLocalSyncMutation<SQLite.SQLiteDatabase>({
  withTransaction: async operation => {
    const generation = getDatasetGeneration();
    assertDatasetCurrent(generation);
    await db.withExclusiveTransactionAsync(async transaction => {
      assertDatasetCurrent(generation);
      const intent = await readDeletionIntent(transaction);
      if (intent?.phase === 'cleanup' || intent?.phase === 'cleared')
        throw new Error('Finish device cleanup in Settings before recording more data.');
      await operation(transaction);
      assertDatasetCurrent(generation);
    });
    assertDatasetCurrent(generation);
  },
  enqueue: async (entityType, operation, payload, createdAt, transaction) => {
    await enqueueSyncJob({ entityType, operation, payload: JSON.stringify(payload), createdAt }, transaction);
  },
  triggerQueuedSync: processSyncQueue,
  now: () => new Date().toISOString(),
});

export const persistAndQueueSync = localSyncMutation.persistAndQueue;
export const persistAndQueueSyncBatch = localSyncMutation.persistBatch;
