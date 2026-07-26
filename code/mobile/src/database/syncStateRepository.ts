import * as SQLite from "expo-sqlite";
import { db } from "./db";

const PULL_CURSOR_KEY = "pull_cursor";

export async function getPullCursor(): Promise<number> {
  const state = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_state WHERE key = ?`,
    PULL_CURSOR_KEY,
  );
  const cursor = Number(state?.value ?? 0);
  return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
}

export async function setPullCursor(
  cursor: number,
  database: SQLite.SQLiteDatabase = db,
): Promise<void> {
  await database.runAsync(
    `INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)`,
    PULL_CURSOR_KEY,
    String(cursor),
  );
}
