import { db } from './db';
import { SyncEntityType, SyncOperationByEntity } from '../domain/sync';
import { nextRetryAt } from '../services/sync/retryPolicy';
import * as SQLite from 'expo-sqlite';

interface SyncJobBase {
    id?: number;
    payload: string;
    createdAt: string;
    lastError?: string | null;
    retryCount?: number;
    nextAttemptAt?: string | null;
}

export type SyncJobForEntity<EntityType extends SyncEntityType> = SyncJobBase & {
    entityType: EntityType;
    operation: SyncOperationByEntity[EntityType];
};

export type SyncJob = {
    [EntityType in SyncEntityType]: SyncJobForEntity<EntityType>;
}[SyncEntityType];

export const enqueueSyncJob = async <EntityType extends SyncEntityType>(
    job: Omit<SyncJobForEntity<EntityType>, 'id'>,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync(
        `
      INSERT INTO sync_queue (
        entityType, operation, payload, createdAt, lastError, retryCount, nextAttemptAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
        job.entityType,
        job.operation,
        job.payload,
        job.createdAt,
        job.lastError ?? null,
        job.retryCount ?? 0,
        job.nextAttemptAt ?? null,
    );
};

export const getSyncJobs = async (): Promise<SyncJob[]> => {
    return db.getAllAsync<SyncJob>(
        `
      SELECT * FROM sync_queue
      WHERE nextAttemptAt IS NULL OR nextAttemptAt <= ?
      ORDER BY createdAt ASC, id ASC
    `,
        new Date().toISOString(),
    );
};

export const deleteSyncJob = async (jobId: number): Promise<void> => {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, jobId);
};

export const markSyncJobError = async (
    job: Required<Pick<SyncJobBase, 'id'>> & Pick<SyncJobBase, 'retryCount'>,
    message: string,
): Promise<void> => {
    const retryCount = (job.retryCount ?? 0) + 1;

    await db.runAsync(
        `
      UPDATE sync_queue
      SET lastError = ?,
          retryCount = ?,
          nextAttemptAt = ?
      WHERE id = ?
        `,
        message,
        retryCount,
        nextRetryAt(retryCount),
        job.id,
    );
};
