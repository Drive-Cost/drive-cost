import type { SQLiteDatabase } from 'expo-sqlite';
import { db } from './db';
import { resetAccountDataset } from './accountDataRepository';
import { getSyncOwner, setSessionBlocked } from './syncStateRepository';

export type DeletionIntent = {
  ownerId: string;
  mode: 'guest' | 'registered';
  phase: 'unknown' | 'rejected' | 'confirmed' | 'cleanup' | 'cleared';
  signature: string;
  completedAt?: string;
};
const key = 'account_deletion';
export async function readDeletionIntent(database: SQLiteDatabase = db): Promise<DeletionIntent | null> {
  const row = await database.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', key);
  if (!row) return null;
  const value: unknown = JSON.parse(row.value);
  if (!value || typeof value !== 'object') throw new Error('Account deletion recovery needs attention.');
  const input = value as Record<string, unknown>;
  if (
    typeof input.ownerId !== 'string' ||
    !input.ownerId ||
    (input.mode !== 'guest' && input.mode !== 'registered') ||
    !['unknown', 'rejected', 'confirmed', 'cleanup', 'cleared'].includes(String(input.phase)) ||
    typeof input.signature !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.signature) ||
    (!['unknown', 'rejected'].includes(String(input.phase)) &&
      (typeof input.completedAt !== 'string' || !Number.isFinite(Date.parse(input.completedAt))))
  ) {
    throw new Error('Account deletion recovery needs attention.');
  }
  return {
    ownerId: input.ownerId,
    mode: input.mode,
    phase: input.phase as DeletionIntent['phase'],
    signature: input.signature,
    ...(typeof input.completedAt === 'string' ? { completedAt: input.completedAt } : {}),
  };
}
export async function writeDeletionIntent(intent: DeletionIntent, database: SQLiteDatabase): Promise<void> {
  await database.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', key, JSON.stringify(intent));
  await setSessionBlocked(true, database);
}
export async function removeDeletionIntent(database: SQLiteDatabase): Promise<void> {
  await database.runAsync('DELETE FROM sync_state WHERE key = ?', key);
}

/** Raw rows include every business field and orphan; retry metadata cannot manufacture new records. */
export async function deletionDatasetSignature(database: SQLiteDatabase): Promise<string> {
  const rows = [];
  for (const table of [
    'vehicles',
    'fuel_entries',
    'charging_entries',
    'maintenance_entries',
    'ownership_expenses',
    'recurring_expenses',
  ]) {
    rows.push(await database.getAllAsync(`SELECT * FROM ${table} ORDER BY id`));
  }
  const Crypto = await import('expo-crypto');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(rows));
}
export async function clearDeletedDataset(intent: DeletionIntent, database: SQLiteDatabase): Promise<void> {
  if (intent.phase !== 'cleanup' || !intent.completedAt) throw new Error('Cloud deletion has not been confirmed.');
  const owner = await getSyncOwner(database);
  if (owner?.userId !== intent.ownerId) throw new Error('Device account changed. Records have been preserved.');
  if ((await deletionDatasetSignature(database)) !== intent.signature)
    throw new Error('Device records changed. Review deletion again.');
  await resetAccountDataset(database);
  await database.runAsync("DELETE FROM sync_state WHERE key = 'account_unavailable'");
  await writeDeletionIntent({ ...intent, phase: 'cleared' }, database);
}
