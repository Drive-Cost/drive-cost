import type { InsertRecordInput, StoredRow } from '../models/record';
import type { UpdateVehicleInput } from '../models/Vehicle';
import { decodePersistedRecord, requirePersistedLocalId, requirePersistedClientId } from './clientId';
import { db } from './db';
import { Vehicle } from '../models/Vehicle';
import { VehicleSyncPayload } from '../domain/sync';
import * as SQLite from 'expo-sqlite';

export const addVehicle = async (
  vehicle: InsertRecordInput<Vehicle>,
  database: SQLite.SQLiteDatabase = db
): Promise<Vehicle> => {
  requirePersistedClientId(vehicle.clientId, 'Vehicle');
  const result = await database.runAsync(
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
    vehicle.currentOdometer
  );
  return decodePersistedRecord(
    {
      ...vehicle,
      id: result.lastInsertRowId,
      currentMileage: vehicle.currentOdometer,
      trackingStartDate: vehicle.trackingStartDate ?? null,
    },
    'Vehicle'
  );
};

export const getVehicles = async (database: SQLite.SQLiteDatabase = db): Promise<Vehicle[]> => {
  const vehicles = await database.getAllAsync<StoredRow<Vehicle>>(`
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
  return vehicles.map(decodeVehicle);
};

export const deleteVehicleById = async (vehicleId: number, database: SQLite.SQLiteDatabase = db): Promise<string> => {
  const vehicle = await database.getFirstAsync<Pick<Vehicle, 'clientId'>>(
    'SELECT clientId FROM vehicles WHERE id = ?',
    vehicleId
  );
  if (!vehicle?.clientId) throw new Error('Vehicle could not be deleted. Please try again.');

  const result = await database.runAsync('DELETE FROM vehicles WHERE id = ?', vehicleId);
  if (result.changes !== 1) throw new Error('Vehicle could not be deleted. Please try again.');
  return vehicle.clientId;
};

export const deleteVehicleFromSync = async (clientId: string, database: SQLite.SQLiteDatabase = db): Promise<void> => {
  await database.runAsync('DELETE FROM vehicles WHERE clientId = ?', clientId);
};

export const getVehicleById = async (
  vehicleId: number,
  database: SQLite.SQLiteDatabase = db
): Promise<Vehicle | null> => {
  const vehicle = await database.getFirstAsync<StoredRow<Vehicle>>(`SELECT * FROM vehicles WHERE id = ?`, vehicleId);

  return vehicle ? decodeVehicle(vehicle) : null;
};

function decodeVehicle(row: StoredRow<Vehicle>): Vehicle {
  return decodePersistedRecord(
    {
      ...row,
      label: row.label ?? undefined,
      fuelType: row.fuelType ?? undefined,
      engine: row.engine ?? undefined,
      powerHp: row.powerHp ?? undefined,
      transmission: row.transmission ?? undefined,
      currentMileage: row.currentMileage ?? undefined,
    },
    'Vehicle'
  );
}

export const updateVehicleCurrentOdometer = async (
  vehicleId: number,
  odometer: number,
  database: SQLite.SQLiteDatabase = db
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
    vehicleId
  );
};

export const updateVehicle = async (
  vehicle: UpdateVehicleInput,
  database: SQLite.SQLiteDatabase = db
): Promise<Vehicle> => {
  const id = requirePersistedLocalId(vehicle.id, 'Vehicle');
  const existing = await getVehicleById(id, database);
  if (!existing) throw new Error('Vehicle could not be found. Please try again.');

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
    existing.clientId,
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
    id
  );
  return {
    ...vehicle,
    id,
    clientId: existing.clientId,
    currentMileage: vehicle.currentOdometer,
    trackingStartDate: vehicle.trackingStartDate ?? null,
  };
};

export const upsertVehicleFromSync = async (
  vehicle: VehicleSyncPayload,
  database: SQLite.SQLiteDatabase = db
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
    vehicle.currentOdometer
  );
};
