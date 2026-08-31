import { db } from "../../../database/db";
import { getPullCursor, setPullCursor } from "../../../database/syncStateRepository";
import { upsertVehicleFromSync } from "../../../database/vehicleRepository";
import { upsertFuelEntryFromSync } from "../../../database/fuelRepository";
import { upsertMaintenanceEntryFromSync } from "../../../database/maintenanceRepository";
import { RemoteChange } from "../../../domain/sync";
import { apiClient } from "../apiClient";
import { reconcilePulledChanges } from "./pullSyncEngine";

export async function pullRemoteChanges(): Promise<number> {
  if (!apiClient.isConfigured || !apiClient.hasSession()) return 0;

  return reconcilePulledChanges({
    getCursor: getPullCursor,
    pullChanges: apiClient.pullChanges,
    withTransaction: (operation) => db.withExclusiveTransactionAsync(operation),
    applyChange,
    setCursor: setPullCursor,
  });
}

async function applyChange(
  change: RemoteChange,
  transaction: typeof db,
): Promise<void> {
  switch (change.entityType) {
    case "vehicle":
      return upsertVehicleFromSync(change.payload, transaction);
    case "fuel_entry":
      return upsertFuelEntryFromSync(change.payload, transaction);
    case "maintenance_entry":
      return upsertMaintenanceEntryFromSync(change.payload, transaction);
  }
}
