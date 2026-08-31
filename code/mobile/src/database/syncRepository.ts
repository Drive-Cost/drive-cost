import { db } from "./db";
import { SyncEntityType } from "../domain/sync";

export interface SyncJob {
  id?: number;
  entityType: SyncEntityType;
  operation: string;
  payload: string;
  createdAt: string;
  lastError?: string | null;
  retryCount?: number;
  nextAttemptAt?: string | null;
}

export const enqueueSyncJob = async (job: SyncJob): Promise<void> => {
  await db.runAsync(
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
  jobId: number,
  message: string,
): Promise<void> => {
  await db.runAsync(
    `
      UPDATE sync_queue
      SET lastError = ?,
          retryCount = retryCount + 1,
          nextAttemptAt = ?
      WHERE id = ?
    `,
    message,
    getNextRetryAt(),
    jobId,
  );
};

function getNextRetryAt(): string {
  // The queue is retried on app launch and new writes. Backoff prevents an
  // unreachable backend from consuming battery or blocking later local work.
  const retryDelayMs = 30_000;
  return new Date(Date.now() + retryDelayMs).toISOString();
}
