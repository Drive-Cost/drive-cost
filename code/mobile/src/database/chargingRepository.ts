import * as SQLite from 'expo-sqlite';
import { ChargingEntrySyncPayload } from '../domain/sync';
import { ChargingEntry } from '../models/ChargingEntry';
import { requirePersistedClientId, requirePersistedLocalId } from './clientId';
import { db } from './db';
import { findVehicleIdByClientId } from './vehicleLookup';

export async function addChargingEntry(entry: ChargingEntry, database: SQLite.SQLiteDatabase = db): Promise<void> {
    await database.runAsync(
        `INSERT INTO charging_entries (clientId, vehicleId, date, kWh, price, odometer) VALUES (?, ?, ?, ?, ?, ?)`,
        entry.clientId ?? null,
        entry.vehicleId,
        entry.date,
        entry.kWh,
        entry.price,
        entry.odometer,
    );
}

export function getChargingEntries(vehicleId: number): Promise<ChargingEntry[]> {
    return db.getAllAsync<ChargingEntry>(
        'SELECT * FROM charging_entries WHERE vehicleId = ? ORDER BY date DESC, id DESC',
        vehicleId,
    );
}

export async function deleteChargingEntryById(entryId: number, database: SQLite.SQLiteDatabase = db): Promise<string> {
    const clientId = await findChargingEntryClientId(entryId, database);
    await database.runAsync('DELETE FROM charging_entries WHERE id = ?', entryId);
    return clientId;
}

export async function deleteChargingEntryFromSync(clientId: string, database: SQLite.SQLiteDatabase = db): Promise<void> {
    await database.runAsync('DELETE FROM charging_entries WHERE clientId = ?', clientId);
}

export async function upsertChargingEntryFromSync(
    entry: ChargingEntrySyncPayload,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> {
    const vehicleId = await findVehicleIdByClientId(entry.vehicleClientId, database);
    await database.runAsync(
        `INSERT INTO charging_entries (clientId, vehicleId, date, kWh, price, odometer)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(clientId) DO UPDATE SET vehicleId = excluded.vehicleId, date = excluded.date,
           kWh = excluded.kWh, price = excluded.price, odometer = excluded.odometer`,
        entry.clientId,
        vehicleId,
        entry.date,
        entry.kWh,
        entry.price,
        entry.odometer,
    );
}

async function findChargingEntryClientId(entryId: number, database: SQLite.SQLiteDatabase): Promise<string> {
    const localId = requirePersistedLocalId(entryId, 'Charging entry');
    const entry = await database.getFirstAsync<Pick<ChargingEntry, 'clientId'>>(
        'SELECT clientId FROM charging_entries WHERE id = ?',
        localId,
    );
    return requirePersistedClientId(entry?.clientId, 'Charging entry');
}
