import type { InsertRecordInput, StoredRow } from '../models/record';
import type { UpdateMaintenanceEntryInput } from '../models/MaintenanceEntry';
import { MaintenanceEntry } from '../models/MaintenanceEntry';
import { db } from './db';
import { MaintenanceEntrySyncPayload } from '../domain/sync';
import * as SQLite from 'expo-sqlite';
import { findVehicleIdByClientId } from './vehicleLookup';
import { requirePersistedClientId, requirePersistedLocalId, decodePersistedRecord } from './clientId';

export const addMaintenanceEntry = async (
  maintenanceEntry: InsertRecordInput<MaintenanceEntry>,
  database: SQLite.SQLiteDatabase = db
): Promise<MaintenanceEntry> => {
  requirePersistedClientId(maintenanceEntry.clientId, 'Maintenance entry');
  const result = await database.runAsync(
    `INSERT INTO maintenance_entries
      (clientId, vehicleId, type, description, cost, date, odometer)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    maintenanceEntry.clientId,
    maintenanceEntry.vehicleId,
    maintenanceEntry.type,
    maintenanceEntry.description,
    maintenanceEntry.cost,
    maintenanceEntry.date,
    maintenanceEntry.odometer
  );

  return decodePersistedRecord({ ...maintenanceEntry, id: result.lastInsertRowId }, 'Maintenance entry');
};

export const getMaintenanceEntries = async (
  vehicleId: number,
  database: SQLite.SQLiteDatabase = db
): Promise<MaintenanceEntry[]> => {
  const entries = await database.getAllAsync<StoredRow<MaintenanceEntry>>(
    `SELECT * FROM maintenance_entries WHERE vehicleId = ? ORDER BY date DESC`,
    vehicleId
  );
  return entries.map(row => decodePersistedRecord(row, 'Maintenance entry'));
};

export const updateMaintenanceEntry = async (
  maintenanceEntry: UpdateMaintenanceEntryInput,
  database: SQLite.SQLiteDatabase = db
): Promise<MaintenanceEntry> => {
  const entryId = requirePersistedLocalId(maintenanceEntry.id, 'Maintenance entry');
  const clientId = await findMaintenanceEntryClientId(entryId, database);
  await database.runAsync(
    `
      UPDATE maintenance_entries
      SET vehicleId = ?, type = ?, description = ?, cost = ?, date = ?, odometer = ?
      WHERE id = ?
    `,
    maintenanceEntry.vehicleId,
    maintenanceEntry.type,
    maintenanceEntry.description,
    maintenanceEntry.cost,
    maintenanceEntry.date,
    maintenanceEntry.odometer,
    entryId
  );
  return { ...maintenanceEntry, clientId };
};

export const deleteMaintenanceEntryById = async (
  entryId: number,
  database: SQLite.SQLiteDatabase = db
): Promise<string> => {
  const clientId = await findMaintenanceEntryClientId(entryId, database);
  await database.runAsync('DELETE FROM maintenance_entries WHERE id = ?', entryId);
  return clientId;
};

export const deleteMaintenanceEntryFromSync = async (
  clientId: string,
  database: SQLite.SQLiteDatabase = db
): Promise<void> => {
  await database.runAsync('DELETE FROM maintenance_entries WHERE clientId = ?', clientId);
};

export const upsertMaintenanceEntryFromSync = async (
  entry: MaintenanceEntrySyncPayload,
  database: SQLite.SQLiteDatabase = db
): Promise<void> => {
  const vehicleId = await findVehicleIdByClientId(entry.vehicleClientId, database);

  await database.runAsync(
    `
      INSERT INTO maintenance_entries (
        clientId, vehicleId, type, description, cost, date, odometer
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(clientId) DO UPDATE SET
        vehicleId = excluded.vehicleId,
        type = excluded.type,
        description = excluded.description,
        cost = excluded.cost,
        date = excluded.date,
        odometer = excluded.odometer
    `,
    entry.clientId,
    vehicleId,
    entry.type,
    entry.description,
    entry.cost,
    entry.date,
    entry.odometer
  );
};

async function findMaintenanceEntryClientId(
  entryId: number | undefined,
  database: SQLite.SQLiteDatabase
): Promise<string> {
  const localId = requirePersistedLocalId(entryId, 'Maintenance entry');
  const entry = await database.getFirstAsync<Pick<MaintenanceEntry, 'clientId'>>(
    'SELECT clientId FROM maintenance_entries WHERE id = ?',
    localId
  );
  return requirePersistedClientId(entry?.clientId, 'Maintenance entry');
}
