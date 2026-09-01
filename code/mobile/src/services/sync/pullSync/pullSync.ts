import { db } from '../../../database/db';
import { getPullCursor, setPullCursor } from '../../../database/syncStateRepository';
import { upsertVehicleFromSync } from '../../../database/vehicleRepository';
import { deleteFuelEntryFromSync, upsertFuelEntryFromSync } from '../../../database/fuelRepository';
import { deleteMaintenanceEntryFromSync, upsertMaintenanceEntryFromSync } from '../../../database/maintenanceRepository';
import { RemoteChange, SyncEntity, SyncOperation } from '../../../domain/sync';
import { apiClient } from '../apiClient';
import { reconcilePulledChanges } from './pullSyncEngine';

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

async function applyChange(change: RemoteChange, transaction: typeof db): Promise<void> {
    if (change.operation === SyncOperation.Delete) {
        return applyDeleteChange(change, transaction);
    }

    switch (change.entityType) {
        case SyncEntity.Vehicle:
            return upsertVehicleFromSync(change.payload, transaction);
        case SyncEntity.FuelEntry:
            return upsertFuelEntryFromSync(change.payload, transaction);
        case SyncEntity.MaintenanceEntry:
            return upsertMaintenanceEntryFromSync(change.payload, transaction);
    }
}

async function applyDeleteChange(
    change: Extract<RemoteChange, { operation: typeof SyncOperation.Delete }>,
    transaction: typeof db,
): Promise<void> {
    switch (change.entityType) {
        case SyncEntity.FuelEntry:
            return deleteFuelEntryFromSync(change.payload.clientId, transaction);
        case SyncEntity.MaintenanceEntry:
            return deleteMaintenanceEntryFromSync(change.payload.clientId, transaction);
    }
}
