import * as SQLite from 'expo-sqlite';
import { db } from './db';

const SYNC_OWNER_ID_KEY = 'sync_owner_id';
const SYNC_OWNER_MODE_KEY = 'sync_owner_mode';
const PULL_CURSOR_PREFIX = 'pull_cursor:';

export type SyncOwnerBinding = {
  userId: string;
  mode: 'guest' | 'registered';
};

export async function getSyncOwner(database: SQLite.SQLiteDatabase = db): Promise<SyncOwnerBinding | null> {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM sync_state WHERE key IN (?, ?)`,
    SYNC_OWNER_ID_KEY,
    SYNC_OWNER_MODE_KEY
  );
  const values = new Map(rows.map(row => [row.key, row.value]));
  const userId = values.get(SYNC_OWNER_ID_KEY);
  const mode = values.get(SYNC_OWNER_MODE_KEY);
  return userId && (mode === 'guest' || mode === 'registered') ? { userId, mode } : null;
}

export async function bindSyncOwner(owner: SyncOwnerBinding, database?: SQLite.SQLiteDatabase): Promise<void> {
  const write = async (transaction: SQLite.SQLiteDatabase) => {
    await transaction.runAsync(
      `INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?), (?, ?)`,
      SYNC_OWNER_ID_KEY,
      owner.userId,
      SYNC_OWNER_MODE_KEY,
      owner.mode
    );
  };
  if (database) await write(database);
  else await db.withExclusiveTransactionAsync(write);
}

export async function getPullCursor(ownerId: string, database: SQLite.SQLiteDatabase = db): Promise<number> {
  const state = await database.getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_state WHERE key = ?`,
    `${PULL_CURSOR_PREFIX}${ownerId}`
  );
  const cursor = Number(state?.value ?? 0);
  return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
}

export async function setPullCursor(
  ownerId: string,
  cursor: number,
  database: SQLite.SQLiteDatabase = db
): Promise<void> {
  await database.runAsync(
    `INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)`,
    `${PULL_CURSOR_PREFIX}${ownerId}`,
    String(cursor)
  );
}

/** Durable local sign-out intent also protects activation across SecureStore/SQLite boundaries. */
export async function isSessionBlocked(database: SQLite.SQLiteDatabase = db): Promise<boolean> {
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_state WHERE key = 'session_blocked'"
  );
  return row?.value === '1';
}

export async function setSessionBlocked(blocked: boolean, database: SQLite.SQLiteDatabase = db): Promise<void> {
  await database.runAsync(
    "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('session_blocked', ?)",
    blocked ? '1' : '0'
  );
}
