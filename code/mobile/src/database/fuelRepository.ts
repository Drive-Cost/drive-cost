import { FuelEntry } from "../models/FuelEntry";
import { db } from "./db";

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
