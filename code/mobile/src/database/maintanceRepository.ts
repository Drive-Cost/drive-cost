import { MaintenanceEntry } from "../models/MaintenanceEntry";
import { db } from "./db";

export const addMaintenanceEntry = async (
  maintenanceEntry: MaintenanceEntry,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO maintenance_entries
      (vehicleId, type, description, cost, date, odometer)
      VALUES (?, ?, ?, ?, ?, ?)`,
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
