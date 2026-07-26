import { deleteSyncJob, getSyncJobs, markSyncJobError } from "../database/syncRepository";
import { apiClient } from "./apiClient";
import { pullRemoteChanges } from "./pullSync";

let activeSync: Promise<void> | null = null;
const remoteChangeListeners = new Set<(appliedChanges: number) => Promise<void>>();

async function syncJob(job: {
  id?: number;
  entityType: string;
  payload: string;
}) {
  const payload = JSON.parse(job.payload);

  switch (job.entityType) {
    case "vehicle":
      await apiClient.syncVehicle(payload);
      return;
    case "fuel_entry":
      await apiClient.syncFuelEntry(payload);
      return;
    case "maintenance_entry":
      await apiClient.syncMaintenanceEntry(payload);
      return;
    default:
      throw new Error(`Unsupported sync entity type: ${job.entityType}`);
  }
}

async function syncQueue() {
  if (!apiClient.isConfigured || !apiClient.hasSession()) {
    return;
  }

  const jobs = await getSyncJobs();

  for (const job of jobs) {
    if (!job.id) continue;

    try {
      await syncJob(job);
      await deleteSyncJob(job.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown sync error";
      await markSyncJobError(job.id, message);
      break;
    }
  }

  const appliedChanges = await pullRemoteChanges();
  if (appliedChanges > 0) {
    await Promise.all(
      [...remoteChangeListeners].map((listener) => listener(appliedChanges)),
    );
  }
}

export function subscribeToRemoteChanges(
  listener: (appliedChanges: number) => Promise<void>,
): () => void {
  remoteChangeListeners.add(listener);
  return () => remoteChangeListeners.delete(listener);
}

export function processSyncQueue(): Promise<void> {
  if (!activeSync) {
    activeSync = syncQueue().finally(() => {
      activeSync = null;
    });
  }

  return activeSync;
}
