import type { InsertRecordInput, StoredRow } from '../models/record';
import type { UpdateExpenseEntryInput } from '../models/ExpenseEntry';
import * as SQLite from 'expo-sqlite';
import { ExpenseEntry, normalizeExpenseEntry } from '../models/ExpenseEntry';
import { db } from './db';
import { requirePersistedClientId, requirePersistedLocalId, decodePersistedRecord } from './clientId';
import { ExpenseEntrySyncPayload } from '../domain/sync';
import { findVehicleIdByClientId } from './vehicleLookup';

export async function addExpenseEntry(
  entry: InsertRecordInput<ExpenseEntry>,
  database: SQLite.SQLiteDatabase = db
): Promise<ExpenseEntry> {
  requirePersistedClientId(entry.clientId, 'Ownership expense');
  const result = await database.runAsync(
    `INSERT INTO ownership_expenses (clientId, vehicleId, category, totalPaid, description, date, odometer)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    entry.clientId,
    entry.vehicleId,
    entry.category,
    entry.totalPaid,
    entry.description ?? null,
    entry.date,
    entry.odometer ?? null
  );

  return decodePersistedRecord({ ...entry, id: result.lastInsertRowId }, 'Ownership expense');
}

export async function getExpenseEntries(
  vehicleId: number,
  database: SQLite.SQLiteDatabase = db
): Promise<ExpenseEntry[]> {
  const entries = await database.getAllAsync<StoredRow<ExpenseEntry>>(
    `SELECT id, clientId, vehicleId, category, totalPaid, description, date, odometer
         FROM ownership_expenses WHERE vehicleId = ? ORDER BY date DESC, id DESC`,
    vehicleId
  );
  return entries.map(row => decodePersistedRecord(normalizeExpenseEntry(row), 'Ownership expense'));
}

export async function updateExpenseEntry(
  entry: UpdateExpenseEntryInput,
  database: SQLite.SQLiteDatabase = db
): Promise<ExpenseEntry> {
  const entryId = requirePersistedLocalId(entry.id, 'Ownership expense');
  const clientId = await findExpenseClientId(entryId, database);
  await database.runAsync(
    `UPDATE ownership_expenses
         SET vehicleId = ?, category = ?, totalPaid = ?, description = ?, date = ?, odometer = ?
         WHERE id = ?`,
    entry.vehicleId,
    entry.category,
    entry.totalPaid,
    entry.description ?? null,
    entry.date,
    entry.odometer ?? null,
    entryId
  );
  return { ...entry, clientId };
}

export async function deleteExpenseEntryById(entryId: number, database: SQLite.SQLiteDatabase = db): Promise<string> {
  const clientId = await findExpenseClientId(entryId, database);
  await database.runAsync(`DELETE FROM ownership_expenses WHERE id = ?`, entryId);
  return clientId;
}

async function findExpenseClientId(entryId: number, database: SQLite.SQLiteDatabase): Promise<string> {
  const entry = await database.getFirstAsync<Pick<ExpenseEntry, 'clientId'>>(
    `SELECT clientId FROM ownership_expenses WHERE id = ?`,
    entryId
  );
  return requirePersistedClientId(entry?.clientId, 'Ownership expense');
}

export async function deleteExpenseEntryFromSync(
  clientId: string,
  database: SQLite.SQLiteDatabase = db
): Promise<void> {
  await database.runAsync(`DELETE FROM ownership_expenses WHERE clientId = ?`, clientId);
}

export async function upsertExpenseEntryFromSync(
  entry: ExpenseEntrySyncPayload,
  database: SQLite.SQLiteDatabase = db
): Promise<void> {
  const vehicleId = await findVehicleIdByClientId(entry.vehicleClientId, database);
  await database.runAsync(
    `INSERT INTO ownership_expenses (clientId, vehicleId, category, totalPaid, description, date, odometer)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(clientId) DO UPDATE SET vehicleId = excluded.vehicleId, category = excluded.category,
            totalPaid = excluded.totalPaid, description = excluded.description, date = excluded.date, odometer = excluded.odometer`,
    entry.clientId,
    vehicleId,
    entry.category,
    entry.totalPaid,
    entry.description ?? null,
    entry.date,
    entry.odometer ?? null
  );
}
