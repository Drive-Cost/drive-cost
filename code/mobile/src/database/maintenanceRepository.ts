import { MaintenanceEntry } from "../models/MaintenanceEntry";
import { db } from "./db";
import { MaintenanceEntrySyncPayload } from "../domain/sync";
import * as SQLite from "expo-sqlite";

export const addMaintenanceEntry = async (
  maintenanceEntry: MaintenanceEntry,
): Promise<void> => {
  await db.runAsync(
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

export const getMaintenanceEntries = async (
  vehicleId: number,
): Promise<MaintenanceEntry[]> => {
  return db.getAllAsync<MaintenanceEntry>(
    `SELECT * FROM maintenance_entries WHERE vehicleId = ? ORDER BY date DESC`,
    vehicleId,
  );
};

export const upsertMaintenanceEntryFromSync = async (
  entry: MaintenanceEntrySyncPayload,
  database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
  const vehicle = await database.getFirstAsync<{ id: number }>(
    `SELECT id FROM vehicles WHERE clientId = ?`,
    entry.vehicleClientId,
  );

  if (!vehicle) {
    throw new Error("Cannot apply maintenance before its vehicle is synced.");
  }

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
    vehicle.id,
    entry.type,
    entry.description,
    entry.cost,
    entry.date,
    entry.odometer,
  );
};
