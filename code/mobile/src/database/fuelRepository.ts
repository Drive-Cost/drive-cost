import { FuelEntry } from "../models/FuelEntry";
import { db } from "./db";
import { FuelEntrySyncPayload } from "../domain/sync";
import * as SQLite from "expo-sqlite";

export const addFuelEntry = async (fuelEntry: FuelEntry): Promise<void> => {
  await db.runAsync(
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

export const getFuelEntries = async (
  vehicleId: number,
): Promise<FuelEntry[]> => {
  return db.getAllAsync<FuelEntry>(
    `SELECT * FROM fuel_entries WHERE vehicleId = ? ORDER BY date DESC, id DESC`,
    vehicleId,
  );
};

export const upsertFuelEntryFromSync = async (
  entry: FuelEntrySyncPayload,
  database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
  const vehicle = await database.getFirstAsync<{ id: number }>(
    `SELECT id FROM vehicles WHERE clientId = ?`,
    entry.vehicleClientId,
  );

  if (!vehicle) {
    throw new Error("Cannot apply a fuel entry before its vehicle is synced.");
  }

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
    vehicle.id,
    entry.date,
    entry.liters,
    entry.price,
    entry.odometer,
  );
};
