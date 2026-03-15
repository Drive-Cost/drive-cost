import { deleteSyncJob, getSyncJobs, markSyncJobError } from "../database/syncRepository";
import { apiClient } from "./apiClient";

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

export async function processSyncQueue() {
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
}

