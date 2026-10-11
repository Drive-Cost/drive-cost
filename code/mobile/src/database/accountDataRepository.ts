import type { SQLiteDatabase } from 'expo-sqlite';
import { db } from './db';
import { getVehicles } from './vehicleRepository';
import { getFuelEntries } from './fuelRepository';
import { getChargingEntries } from './chargingRepository';
import { getMaintenanceEntries } from './maintenanceRepository';
import { getExpenseEntries } from './expenseRepository';
import { getRecurringExpenses } from './recurringExpenseRepository';
import { bindSyncOwner, getSyncOwner, setPullCursor, setSessionBlocked } from './syncStateRepository';
import type { SyncOwnerBinding } from './syncStateRepository';
import { SyncEntity } from '../domain/sync';
import type { SyncEntityType, SyncPayloadByEntity } from '../domain/sync';
import {
  toVehicleSyncPayload,
  toFuelEntrySyncPayload,
  toChargingEntrySyncPayload,
  toMaintenanceEntrySyncPayload,
  toExpenseEntrySyncPayload,
  toRecurringExpenseSyncPayload,
} from '../services/sync/syncPayload';

export type AccountEntity = {
  [Entity in SyncEntityType]: { entityType: Entity; payload: SyncPayloadByEntity[Entity] };
}[SyncEntityType];
export type PendingAccountMutation = {
  id: number;
  entityType: string;
  operation: string;
  payload: string;
  createdAt: string;
  retryCount: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
};
export type AccountAdoptionJob = {
  ownerId: string;
  entityType: string;
  clientId: string;
  payload: string;
  cutoffJobId: number;
};
export type AccountDataset = {
  owner: SyncOwnerBinding | null;
  entities: AccountEntity[];
  pending: PendingAccountMutation[];
  vehicleIds: number[];
  signature: string;
};

export async function readAccountDataset(database: SQLiteDatabase = db): Promise<AccountDataset> {
  const owner = await getSyncOwner(database);
  const vehicles = await getVehicles(database);
  const entities: AccountEntity[] = vehicles.map(vehicle => ({
    entityType: SyncEntity.Vehicle,
    payload: toVehicleSyncPayload(vehicle),
  }));
  for (const vehicle of vehicles) {
    const [fuel, charging, maintenance, expenses, recurring] = await Promise.all([
      getFuelEntries(vehicle.id, database),
      getChargingEntries(vehicle.id, database),
      getMaintenanceEntries(vehicle.id, database),
      getExpenseEntries(vehicle.id, database),
      getRecurringExpenses(vehicle.id, database),
    ]);
    entities.push(
      ...fuel.map(entry => ({
        entityType: SyncEntity.FuelEntry,
        payload: toFuelEntrySyncPayload(entry, vehicle.clientId),
      }))
    );
    entities.push(
      ...charging.map(entry => ({
        entityType: SyncEntity.ChargingEntry,
        payload: toChargingEntrySyncPayload(entry, vehicle.clientId),
      }))
    );
    entities.push(
      ...maintenance.map(entry => ({
        entityType: SyncEntity.MaintenanceEntry,
        payload: toMaintenanceEntrySyncPayload(entry, vehicle.clientId),
      }))
    );
    entities.push(
      ...expenses.map(entry => ({
        entityType: SyncEntity.ExpenseEntry,
        payload: toExpenseEntrySyncPayload(entry, vehicle.clientId),
      }))
    );
    entities.push(
      ...recurring.map(entry => ({
        entityType: SyncEntity.RecurringExpense,
        payload: toRecurringExpenseSyncPayload(entry, vehicle.clientId),
      }))
    );
  }
  entities.sort((left, right) => entityKey(left).localeCompare(entityKey(right)));
  const pending = await database.getAllAsync<PendingAccountMutation>('SELECT * FROM sync_queue ORDER BY id');
  const metadata = await database.getAllAsync<{ key: string; value: string }>('SELECT * FROM sync_state ORDER BY key');
  if (!owner && metadata.some(row => row.key === 'sync_owner_id' || row.key === 'sync_owner_mode')) {
    throw new Error('Device ownership could not be verified.');
  }
  const adoption = await getAccountAdoptionJobs(database);
  if (adoption.some(job => job.ownerId !== owner?.userId)) throw new Error('Device ownership could not be verified.');
  return {
    owner,
    entities,
    pending,
    vehicleIds: vehicles.map(vehicle => vehicle.id),
    signature: JSON.stringify({ owner, entities, pending, metadata, adoption }),
  };
}

export function entityKey(entity: { entityType: string; payload: { clientId: string } }): string {
  return JSON.stringify([entity.entityType, entity.payload.clientId]);
}

export async function queueAccountAdoption(
  dataset: AccountDataset,
  ownerId: string,
  database: SQLiteDatabase
): Promise<void> {
  const cutoff = dataset.pending.reduce((latest, job) => Math.max(latest, job.id), 0);
  for (const entity of dataset.entities) {
    await database.runAsync(
      `INSERT INTO account_adoption_queue (ownerId, entityType, clientId, payload, cutoffJobId) VALUES (?, ?, ?, ?, ?)`,
      ownerId,
      entity.entityType,
      entity.payload.clientId,
      JSON.stringify(entity.payload),
      cutoff
    );
  }
}

export async function getAccountAdoptionJobs(database: SQLiteDatabase = db): Promise<AccountAdoptionJob[]> {
  return database.getAllAsync<AccountAdoptionJob>(`SELECT * FROM account_adoption_queue
    ORDER BY CASE WHEN entityType = 'vehicle' THEN 0 ELSE 1 END, entityType, clientId`);
}

/** Existing upserts stay queued until their current state is acknowledged by the server. */
export async function acknowledgeAccountAdoption(job: AccountAdoptionJob, database: SQLiteDatabase): Promise<void> {
  await database.runAsync(
    `DELETE FROM sync_queue WHERE id <= ? AND entityType = ? AND operation = 'upsert'
    AND json_extract(payload, '$.clientId') = ?`,
    job.cutoffJobId,
    job.entityType,
    job.clientId
  );
  await database.runAsync(
    'DELETE FROM account_adoption_queue WHERE ownerId = ? AND entityType = ? AND clientId = ?',
    job.ownerId,
    job.entityType,
    job.clientId
  );
}

/** Called only after remote preflight, inside the same transaction as import and binding. */
export async function resetAccountDataset(database: SQLiteDatabase): Promise<void> {
  for (const table of [
    'fuel_entries',
    'charging_entries',
    'maintenance_entries',
    'ownership_expenses',
    'recurring_expenses',
    'vehicles',
    'sync_queue',
    'account_adoption_queue',
  ]) {
    await database.runAsync(`DELETE FROM ${table}`);
  }
  await database.runAsync(`DELETE FROM sync_state WHERE key IN ('sync_owner_id', 'sync_owner_mode', 'session_blocked')
    OR key GLOB 'pull_cursor:*'`);
}

export async function bindAccountDataset(
  owner: SyncOwnerBinding,
  cursor: number,
  database: SQLiteDatabase
): Promise<void> {
  await bindSyncOwner(owner, database);
  await setPullCursor(owner.userId, cursor, database);
  await setSessionBlocked(true, database);
}
