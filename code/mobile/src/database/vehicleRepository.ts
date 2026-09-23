import { db } from './db';
import { Vehicle } from '../models/Vehicle';
import { VehicleSyncPayload } from '../domain/sync';
import * as SQLite from 'expo-sqlite';

export const addVehicle = async (vehicle: Vehicle, database: SQLite.SQLiteDatabase = db): Promise<void> => {
    await database.runAsync(
        `INSERT INTO vehicles (
      clientId,
      brand,
      model,
      year,
      label,
      fuelType,
      engine,
      powerHp,
      transmission,
      currentMileage,
      ownershipStartMileage,
      trackingStartMileage,
      trackingStartDate,
      currentOdometer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        vehicle.clientId ?? null,
        vehicle.brand,
        vehicle.model,
        vehicle.year,
        vehicle.label ?? null,
        vehicle.fuelType ?? null,
        vehicle.engine ?? null,
        vehicle.powerHp ?? null,
        vehicle.transmission ?? null,
        vehicle.currentOdometer,
        vehicle.ownershipStartMileage,
        vehicle.trackingStartMileage,
        vehicle.trackingStartDate ?? null,
        vehicle.currentOdometer,
    );
};

export const getVehicles = async (): Promise<Vehicle[]> => {
    return db.getAllAsync<Vehicle>(`
    SELECT
      id,
      clientId,
      brand,
      model,
      year,
      label,
      fuelType,
      engine,
      powerHp,
      transmission,
      ownershipStartMileage,
      trackingStartMileage,
      trackingStartDate,
      currentOdometer,
      currentMileage
    FROM vehicles
    ORDER BY id ASC
  `);
};

export const deleteVehicleById = async (
    vehicleId: number,
    database: SQLite.SQLiteDatabase = db,
): Promise<string> => {
    const vehicle = await database.getFirstAsync<Pick<Vehicle, 'clientId'>>(
        'SELECT clientId FROM vehicles WHERE id = ?',
        vehicleId,
    );
    if (!vehicle?.clientId) throw new Error('Vehicle could not be deleted. Please try again.');

    const result = await database.runAsync('DELETE FROM vehicles WHERE id = ?', vehicleId);
    if (result.changes !== 1) throw new Error('Vehicle could not be deleted. Please try again.');
    return vehicle.clientId;
};

export const deleteVehicleFromSync = async (
    clientId: string,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync('DELETE FROM vehicles WHERE clientId = ?', clientId);
};

export const getVehicleById = async (
    vehicleId: number,
    database: SQLite.SQLiteDatabase = db,
): Promise<Vehicle | null> => {
    const vehicle = await database.getFirstAsync<Vehicle>(`SELECT * FROM vehicles WHERE id = ?`, vehicleId);

    return vehicle ?? null;
};

export const updateVehicleCurrentOdometer = async (
    vehicleId: number,
    odometer: number,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync(
        `
      UPDATE vehicles
      SET currentOdometer = CASE
        WHEN currentOdometer IS NULL OR currentOdometer < ? THEN ?
        ELSE currentOdometer
      END
      WHERE id = ?
    `,
        odometer,
        odometer,
        vehicleId,
    );
};

export const updateVehicle = async (vehicle: Vehicle, database: SQLite.SQLiteDatabase = db): Promise<void> => {
    if (!vehicle.id) {
        throw new Error('Vehicle id is required to update a vehicle.');
    }

    await database.runAsync(
        `
      UPDATE vehicles
      SET brand = ?,
          clientId = ?,
          model = ?,
          year = ?,
          label = ?,
          fuelType = ?,
          engine = ?,
          powerHp = ?,
          transmission = ?,
          currentMileage = ?,
          ownershipStartMileage = ?,
          trackingStartMileage = ?,
          trackingStartDate = ?,
          currentOdometer = ?
      WHERE id = ?
    `,
        vehicle.brand,
        vehicle.clientId ?? null,
        vehicle.model,
        vehicle.year,
        vehicle.label ?? null,
        vehicle.fuelType ?? null,
        vehicle.engine ?? null,
        vehicle.powerHp ?? null,
        vehicle.transmission ?? null,
        vehicle.currentOdometer,
        vehicle.ownershipStartMileage,
        vehicle.trackingStartMileage,
        vehicle.trackingStartDate ?? null,
        vehicle.currentOdometer,
        vehicle.id,
    );
};

export const upsertVehicleFromSync = async (
    vehicle: VehicleSyncPayload,
    database: SQLite.SQLiteDatabase = db,
): Promise<void> => {
    await database.runAsync(
        `
      INSERT INTO vehicles (
        clientId, brand, model, year, label, fuelType, engine, powerHp,
        transmission, currentMileage, ownershipStartMileage,
        trackingStartMileage, trackingStartDate, currentOdometer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(clientId) DO UPDATE SET
        brand = excluded.brand,
        model = excluded.model,
        year = excluded.year,
        label = excluded.label,
        fuelType = excluded.fuelType,
        engine = excluded.engine,
        powerHp = excluded.powerHp,
        transmission = excluded.transmission,
        currentMileage = excluded.currentMileage,
        ownershipStartMileage = excluded.ownershipStartMileage,
        trackingStartMileage = excluded.trackingStartMileage,
        trackingStartDate = excluded.trackingStartDate,
        currentOdometer = excluded.currentOdometer
    `,
        vehicle.clientId,
        vehicle.brand,
        vehicle.model,
        vehicle.year,
        vehicle.label ?? null,
        vehicle.fuelType ?? null,
        vehicle.engine ?? null,
        vehicle.powerHp ?? null,
        vehicle.transmission ?? null,
        vehicle.currentOdometer,
        vehicle.ownershipStartMileage,
        vehicle.trackingStartMileage,
        vehicle.trackingStartDate ?? null,
        vehicle.currentOdometer,
    );
};
