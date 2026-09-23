import { db } from '../../../database/db';
import { getPullCursor, setPullCursor } from '../../../database/syncStateRepository';
import { deleteVehicleFromSync, upsertVehicleFromSync } from '../../../database/vehicleRepository';
import { deleteFuelEntryFromSync, upsertFuelEntryFromSync } from '../../../database/fuelRepository';
import { deleteChargingEntryFromSync, upsertChargingEntryFromSync } from '../../../database/chargingRepository';
import { deleteMaintenanceEntryFromSync, upsertMaintenanceEntryFromSync } from '../../../database/maintenanceRepository';
import { deleteExpenseEntryFromSync, upsertExpenseEntryFromSync } from '../../../database/expenseRepository';
import { deleteRecurringExpenseFromSync, upsertRecurringExpenseFromSync } from '../../../database/recurringExpenseRepository';
import { RemoteChange, SyncEntity, SyncOperation } from '../../../domain/sync';
import { apiClient } from '../apiClient';
import { reconcilePulledChanges } from './pullSyncEngine';

export async function pullRemoteChanges(ownerId: string): Promise<number> {
    if (!apiClient.isConfigured || !apiClient.hasSession()) return 0;

    return reconcilePulledChanges({
        getCursor: () => getPullCursor(ownerId),
        pullChanges: apiClient.pullChanges,
        withTransaction: (operation) => db.withExclusiveTransactionAsync(operation),
        applyChange,
        setCursor: (cursor, transaction) => setPullCursor(ownerId, cursor, transaction),
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
        case SyncEntity.ChargingEntry:
            return upsertChargingEntryFromSync(change.payload, transaction);
        case SyncEntity.MaintenanceEntry:
            return upsertMaintenanceEntryFromSync(change.payload, transaction);
        case SyncEntity.ExpenseEntry:
            return upsertExpenseEntryFromSync(change.payload, transaction);
        case SyncEntity.RecurringExpense:
            return upsertRecurringExpenseFromSync(change.payload, transaction);
    }
}

async function applyDeleteChange(
    change: Extract<RemoteChange, { operation: typeof SyncOperation.Delete }>,
    transaction: typeof db,
): Promise<void> {
    switch (change.entityType) {
        case SyncEntity.Vehicle:
            return deleteVehicleFromSync(change.payload.clientId, transaction);
        case SyncEntity.FuelEntry:
            return deleteFuelEntryFromSync(change.payload.clientId, transaction);
        case SyncEntity.ChargingEntry:
            return deleteChargingEntryFromSync(change.payload.clientId, transaction);
        case SyncEntity.MaintenanceEntry:
            return deleteMaintenanceEntryFromSync(change.payload.clientId, transaction);
        case SyncEntity.ExpenseEntry:
            return deleteExpenseEntryFromSync(change.payload.clientId, transaction);
        case SyncEntity.RecurringExpense:
            return deleteRecurringExpenseFromSync(change.payload.clientId, transaction);
    }
}
