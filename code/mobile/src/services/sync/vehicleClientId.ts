import * as SQLite from 'expo-sqlite';
import { getVehicleById } from '../../database/vehicleRepository';
import type { Vehicle } from '../../models/Vehicle';

const VEHICLE_NOT_READY_FOR_SYNC_MESSAGE = 'The vehicle could not be prepared for sync.';

export async function requireVehicleForSync(
    vehicleId: number,
    transaction: SQLite.SQLiteDatabase,
): Promise<Vehicle & { clientId: string }> {
    const vehicle = await getVehicleById(vehicleId, transaction);
    if (!vehicle?.clientId) {
        throw new Error(VEHICLE_NOT_READY_FOR_SYNC_MESSAGE);
    }
    return { ...vehicle, clientId: vehicle.clientId };
}

export async function requireVehicleClientId(
    vehicleId: number,
    transaction: SQLite.SQLiteDatabase,
): Promise<string> {
    return (await requireVehicleForSync(vehicleId, transaction)).clientId;
}
