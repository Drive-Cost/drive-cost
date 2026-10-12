import { migrateAccountAdoption } from '../../src/database/migrations/accountAdoption';
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';

type Adapter = {
  runAsync(sql: string, ...params: SQLInputValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<Row>(sql: string, ...params: SQLInputValue[]): Promise<Row[]>;
  getFirstAsync<Row>(sql: string, ...params: SQLInputValue[]): Promise<Row | null>;
  withExclusiveTransactionAsync(operation: (transaction: Adapter) => Promise<void>): Promise<void>;
};

let connection: DatabaseSync;
let failedRead: string | null = null;
let transactionTail: Promise<void> = Promise.resolve();

export const database: Adapter = {
  async runAsync(sql, ...params) {
    const result = connection.prepare(sql).run(...params);
    return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
  },
  async getAllAsync<Row>(sql: string, ...params: SQLInputValue[]) {
    if (failedRead && sql.includes(failedRead)) {
      failedRead = null;
      throw new Error('Injected snapshot read failure.');
    }
    return connection.prepare(sql).all(...params) as Row[];
  },
  async getFirstAsync<Row>(sql: string, ...params: SQLInputValue[]) {
    return (connection.prepare(sql).get(...params) ?? null) as Row | null;
  },
  async withExclusiveTransactionAsync(operation) {
    const previous = transactionTail;
    let release: () => void = () => undefined;
    transactionTail = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;
    connection.exec('BEGIN');
    try {
      await operation(database);
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    } finally {
      release();
    }
  },
};

export function resetDatabase() {
  connection = new DatabaseSync(':memory:');
  failedRead = null;
  transactionTail = Promise.resolve();
  connection.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT UNIQUE,
      brand TEXT, model TEXT, year INTEGER, label TEXT, fuelType TEXT, engine TEXT,
      powerHp INTEGER, transmission TEXT, currentMileage INTEGER,
      ownershipStartMileage INTEGER, trackingStartMileage INTEGER, trackingStartDate TEXT, currentOdometer INTEGER
    );
    CREATE TABLE fuel_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT UNIQUE,
      vehicleId INTEGER NOT NULL REFERENCES vehicles(id), date TEXT, liters REAL, price REAL, odometer INTEGER, fillStatus TEXT);
    CREATE TABLE charging_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT UNIQUE,
      vehicleId INTEGER NOT NULL REFERENCES vehicles(id), date TEXT, kWh REAL, price REAL, odometer INTEGER);
    CREATE TABLE maintenance_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT UNIQUE,
      vehicleId INTEGER NOT NULL REFERENCES vehicles(id), type TEXT, description TEXT, cost REAL, date TEXT, odometer INTEGER);
    CREATE TABLE ownership_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT UNIQUE,
      vehicleId INTEGER NOT NULL REFERENCES vehicles(id), category TEXT, totalPaid REAL, description TEXT, date TEXT, odometer INTEGER);
    CREATE TABLE recurring_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT UNIQUE,
      vehicleId INTEGER NOT NULL REFERENCES vehicles(id), category TEXT, amount REAL, periodMonths INTEGER,
      startDate TEXT, nextDueDate TEXT, description TEXT, active INTEGER);
    CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, entityType TEXT, operation TEXT,
      payload TEXT, createdAt TEXT, lastError TEXT, retryCount INTEGER, nextAttemptAt TEXT);
  `);
  migrateAccountAdoption({ execSync: execute });
  connection
    .prepare(
      `INSERT INTO vehicles (clientId, brand, model, year, ownershipStartMileage,
    trackingStartMileage, trackingStartDate, currentOdometer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run('vehicle-1', 'Toyota', 'Corolla', 2022, 1_000, 1_000, '2026-10-11', 1_000);
}

export function closeDatabase() {
  connection.close();
}
export function execute(sql: string) {
  connection.exec(sql);
}
export function failNextReadContaining(sql: string) {
  failedRead = sql;
}
export function readRows<Row>(sql: string): Row[] {
  return connection.prepare(sql).all() as Row[];
}
