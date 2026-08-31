import { db } from './db';
import { SyncEntityType, SyncOperation } from '../domain/sync';
import { nextRetryAt } from '../services/sync/retryPolicy';

const OUTBOX_OPERATION = SyncOperation.Upsert;

export interface SyncJob {
    id?: number;
    entityType: SyncEntityType;
    payload: string;
    createdAt: string;
    lastError?: string | null;
    retryCount?: number;
    nextAttemptAt?: string | null;
}

export const enqueueSyncJob = async (job: Omit<SyncJob, 'id'>): Promise<void> => {
    await db.runAsync(
        `
      INSERT INTO sync_queue (
        entityType, operation, payload, createdAt, lastError, retryCount, nextAttemptAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
        job.entityType,
        OUTBOX_OPERATION,
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
    job: Required<Pick<SyncJob, 'id'>> & Pick<SyncJob, 'retryCount'>,
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
