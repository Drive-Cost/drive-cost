import { enqueueSyncJob } from "../database/syncRepository";
import { processSyncQueue } from "./syncService";

export async function queueSyncJob(
  entityType: string,
  operation: string,
  payload: unknown,
) {
  await enqueueSyncJob({
    entityType,
    operation,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
  });

  try {
    await processSyncQueue();
  } catch {
    // Offline or backend unavailable is expected; the queue remains local.
  }
}
