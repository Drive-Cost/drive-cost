import { FuelEntry } from '../models/FuelEntry';
import { db } from './db';
import { FuelEntrySyncPayload } from '../domain/sync';
import * as SQLite from 'expo-sqlite';
import { findVehicleIdByClientId } from './vehicleLookup';
import { requirePersistedClientId } from './clientId';

export const addFuelEntry = async (
    fuelEntry: FuelEntry,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync(
        `INSERT INTO fuel_entries
        (clientId, vehicleId, date, liters, price, odometer)
        VALUES (?, ?, ?, ?, ?, ?)`,
        fuelEntry.clientId ?? null,
        fuelEntry.vehicleId,
        fuelEntry.date,
        fuelEntry.liters,
        fuelEntry.price,
        fuelEntry.odometer,
    );
};

export const getFuelEntries = async (vehicleId: number): Promise<FuelEntry[]> => {
    return db.getAllAsync<FuelEntry>(
        `SELECT * FROM fuel_entries WHERE vehicleId = ? ORDER BY date DESC, id DESC`,
        vehicleId,
    );
};

export const deleteFuelEntryById = async (
    entryId: number,
    database: SQLite.SQLiteDatabase = db,
): Promise<string> => {
    const entry = await database.getFirstAsync<Pick<FuelEntry, 'clientId'>>(
        'SELECT clientId FROM fuel_entries WHERE id = ?',
        entryId,
    );
    const clientId = requirePersistedClientId(entry?.clientId, 'Fuel entry');
    await database.runAsync('DELETE FROM fuel_entries WHERE id = ?', entryId);
    return clientId;
};

export const deleteFuelEntryFromSync = async (
    clientId: string,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync('DELETE FROM fuel_entries WHERE clientId = ?', clientId);
};

export const upsertFuelEntryFromSync = async (
    entry: FuelEntrySyncPayload,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    const vehicleId = await findVehicleIdByClientId(entry.vehicleClientId, database);

    await database.runAsync(
        `
      INSERT INTO fuel_entries (clientId, vehicleId, date, liters, price, odometer)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(clientId) DO UPDATE SET
        vehicleId = excluded.vehicleId,
        date = excluded.date,
        liters = excluded.liters,
        price = excluded.price,
        odometer = excluded.odometer
    `,
        entry.clientId,
        vehicleId,
        entry.date,
        entry.liters,
        entry.price,
        entry.odometer,
    );
};
