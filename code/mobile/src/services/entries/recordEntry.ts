import type { SQLiteDatabase } from 'expo-sqlite';
import { getVehicles, updateVehicleCurrentOdometer } from '../../database/vehicleRepository';
import type { FuelEntry } from '../../models/FuelEntry';
import type { ChargingEntry } from '../../models/ChargingEntry';
import type { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { SyncEntity, SyncOperation } from '../../domain/sync';
import type { SyncPayloadByEntity } from '../../domain/sync';
import { persistAndQueueSyncBatch } from '../sync/offlineSync';
import { requireVehicleForSync } from '../sync/vehicleClientId';
import { toVehicleSyncPayload } from '../sync/syncPayload';

type EntryByEntity = {
  [SyncEntity.FuelEntry]: FuelEntry;
  [SyncEntity.ChargingEntry]: ChargingEntry;
  [SyncEntity.MaintenanceEntry]: MaintenanceEntry;
};

/** One recorded event, its odometer, snapshots, and both outbox jobs share a commit. */
export function recordEntry<Entity extends keyof EntryByEntity>(
  entityType: Entity,
  input: { vehicleId: number; odometer: number },
  persist: (transaction: SQLiteDatabase) => Promise<EntryByEntity[Entity]>,
  readEntries: (vehicleId: number, transaction: SQLiteDatabase) => Promise<EntryByEntity[Entity][]>,
  toPayload: (entry: EntryByEntity[Entity], vehicleClientId: string) => SyncPayloadByEntity[Entity]
) {
  return persistAndQueueSyncBatch(async (transaction, queue) => {
    const entry = await persist(transaction);
    await updateVehicleCurrentOdometer(input.vehicleId, input.odometer, transaction);
    const vehicle = await requireVehicleForSync(input.vehicleId, transaction);

    // Ensure the parent is known remotely before publishing an owned entry.
    await queue(SyncEntity.Vehicle, SyncOperation.Upsert, toVehicleSyncPayload(vehicle));
    await queue(entityType, SyncOperation.Upsert, toPayload(entry, vehicle.clientId));

    return {
      entry,
      entries: await readEntries(input.vehicleId, transaction),
      vehicles: await getVehicles(transaction),
    };
  });
}
