import { deleteSyncJob, getSyncJobs, markSyncJobError } from "../../database/syncRepository";
import { SyncEntityType } from "../../domain/sync";
import { apiClient } from "./apiClient";
import { initializeAuthSession } from "./authSession";
import { pullRemoteChanges } from "./pullSync/pullSync";
import { createSyncStatus, SyncStatus } from "./syncStatus";

let activeSync: Promise<void> | null = null;
const remoteChangeListeners = new Set<(appliedChanges: number) => Promise<void>>();
const syncStatus = createSyncStatus(apiClient.isConfigured ? "offline" : "local-only");

async function syncJob(job: {
  id?: number;
  entityType: SyncEntityType;
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
  if (!apiClient.isConfigured) {
    syncStatus.update({ phase: "local-only", error: null });
    return;
  }

  if (!apiClient.hasSession()) {
    syncStatus.update({ phase: "offline", error: null });
    return;
  }

  syncStatus.update({ phase: "syncing", error: null });

  const jobs = await getSyncJobs();
  let jobError: Error | null = null;

  for (const job of jobs) {
    if (!job.id) continue;

    try {
      await syncJob(job);
      await deleteSyncJob(job.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown sync error";
      await markSyncJobError(job.id, message);
      jobError = new Error(message);
      break;
    }
  }

  const appliedChanges = await pullRemoteChanges();
  if (appliedChanges > 0) {
    await Promise.all(
      [...remoteChangeListeners].map((listener) => listener(appliedChanges)),
    );
  }

  if (jobError) throw jobError;

  syncStatus.update({
    phase: "synced",
    lastSyncedAt: new Date().toISOString(),
    error: null,
  });
}

export function subscribeToRemoteChanges(
  listener: (appliedChanges: number) => Promise<void>,
): () => void {
  remoteChangeListeners.add(listener);
  return () => remoteChangeListeners.delete(listener);
}

export function subscribeToSyncStatus(
  listener: (status: SyncStatus) => void,
): () => void {
  return syncStatus.subscribe(listener);
}

export async function syncDevice(): Promise<void> {
  try {
    await initializeAuthSession();
  } catch {
    // Syncing below exposes a recoverable offline status without blocking local use.
  }

  return processSyncQueue();
}

export function processSyncQueue(): Promise<void> {
  if (!activeSync) {
    activeSync = syncQueue()
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown sync error";
        syncStatus.update({ phase: "error", error: message });
        throw error;
      })
      .finally(() => {
        activeSync = null;
      });
  }

  return activeSync;
}
