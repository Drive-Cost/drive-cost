import { MaintenanceEntry } from '../models/MaintenanceEntry';
import { db } from './db';
import { MaintenanceEntrySyncPayload } from '../domain/sync';
import * as SQLite from 'expo-sqlite';
import { findVehicleIdByClientId } from './vehicleLookup';
import { requirePersistedClientId } from './clientId';

export const addMaintenanceEntry = async (
    maintenanceEntry: MaintenanceEntry,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync(
        `INSERT INTO maintenance_entries
      (clientId, vehicleId, type, description, cost, date, odometer)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
        maintenanceEntry.clientId ?? null,
        maintenanceEntry.vehicleId,
        maintenanceEntry.type,
        maintenanceEntry.description,
        maintenanceEntry.cost,
        maintenanceEntry.date,
        maintenanceEntry.odometer,
    );
};

export const getMaintenanceEntries = async (vehicleId: number): Promise<MaintenanceEntry[]> => {
    return db.getAllAsync<MaintenanceEntry>(
        `SELECT * FROM maintenance_entries WHERE vehicleId = ? ORDER BY date DESC`,
        vehicleId,
    );
};

export const deleteMaintenanceEntryById = async (
    entryId: number,
    database: SQLite.SQLiteDatabase = db,
): Promise<string> => {
    const entry = await database.getFirstAsync<Pick<MaintenanceEntry, 'clientId'>>(
        'SELECT clientId FROM maintenance_entries WHERE id = ?',
        entryId,
    );
    const clientId = requirePersistedClientId(entry?.clientId, 'Maintenance entry');
    await database.runAsync('DELETE FROM maintenance_entries WHERE id = ?', entryId);
    return clientId;
};

export const deleteMaintenanceEntryFromSync = async (
    clientId: string,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync('DELETE FROM maintenance_entries WHERE clientId = ?', clientId);
};

export const upsertMaintenanceEntryFromSync = async (
    entry: MaintenanceEntrySyncPayload,
    database: SQLite.SQLiteDatabase = db,
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
        entry.odometer,
    );
};
