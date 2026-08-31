import * as SQLite from 'expo-sqlite';
import { db } from './db';

const VEHICLE_NOT_SYNCED_MESSAGE = 'Cannot apply an entry before its vehicle is synced.';

export async function findVehicleIdByClientId(
    vehicleClientId: string,
    database: SQLite.SQLiteDatabase = db,
): Promise<number> {
    const vehicle = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM vehicles WHERE clientId = ?',
        vehicleClientId,
    );

    if (!vehicle) {
        throw new Error(VEHICLE_NOT_SYNCED_MESSAGE);
    }

    return vehicle.id;
}
