import type { SQLiteDatabase } from 'expo-sqlite';

/** Forward-only, additive migration: durable initial uploads for an explicitly adopted dataset. */
export function migrateAccountAdoption(database: Pick<SQLiteDatabase, 'execSync'>): void {
  database.execSync(`CREATE TABLE IF NOT EXISTS account_adoption_queue (
    ownerId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    clientId TEXT NOT NULL,
    payload TEXT NOT NULL,
    cutoffJobId INTEGER NOT NULL,
    PRIMARY KEY (entityType, clientId)
  );`);
}
