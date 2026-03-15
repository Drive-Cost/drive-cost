import { db } from "./db";

export interface SyncJob {
  id?: number;
  entityType: string;
  operation: string;
  payload: string;
  createdAt: string;
  lastError?: string | null;
}

export const enqueueSyncJob = async (job: SyncJob): Promise<void> => {
  await db.runAsync(
    `
      INSERT INTO sync_queue (entityType, operation, payload, createdAt, lastError)
      VALUES (?, ?, ?, ?, ?)
    `,
    job.entityType,
    job.operation,
    job.payload,
    job.createdAt,
    job.lastError ?? null,
  );
};

export const getSyncJobs = async (): Promise<SyncJob[]> => {
  return db.getAllAsync<SyncJob>(
    `SELECT * FROM sync_queue ORDER BY createdAt ASC, id ASC`,
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
    `UPDATE sync_queue SET lastError = ? WHERE id = ?`,
    message,
    jobId,
  );
};

