import type { SQLiteDatabase } from 'expo-sqlite';
import { SyncOperation } from '../../domain/sync';
import type { SyncEntityType } from '../../domain/sync';
import { persistAndQueueSyncBatch } from '../sync/offlineSync';

export function deleteEntry<Entry>(
  entity: SyncEntityType,
  id: number,
  vehicleId: number,
  remove: (id: number, transaction: SQLiteDatabase) => Promise<string>,
  read: (vehicleId: number, transaction: SQLiteDatabase) => Promise<Entry[]>
): Promise<Entry[]> {
  return persistAndQueueSyncBatch(async (transaction, queue) => {
    const clientId = await remove(id, transaction);
    await queue(entity, SyncOperation.Delete, { clientId });
    return read(vehicleId, transaction);
  });
}
