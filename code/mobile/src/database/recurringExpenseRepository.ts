import * as SQLite from 'expo-sqlite';
import { RecurringExpense, normalizeRecurringExpense } from '../models/RecurringExpense';
import { db } from './db';
import { requirePersistedClientId, requirePersistedLocalId } from './clientId';
import { RecurringExpenseSyncPayload } from '../domain/sync';
import { findVehicleIdByClientId } from './vehicleLookup';

export async function addRecurringExpense(entry: RecurringExpense, database: SQLite.SQLiteDatabase = db): Promise<void> {
    await database.runAsync(
        `INSERT INTO recurring_expenses (clientId, vehicleId, category, amount, periodMonths, startDate, nextDueDate, description, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.clientId ?? null, entry.vehicleId, entry.category, entry.amount, entry.periodMonths,
        entry.startDate, entry.nextDueDate ?? null, entry.description ?? null, entry.active ? 1 : 0,
    );
}

export async function getRecurringExpenses(vehicleId: number, database: SQLite.SQLiteDatabase = db): Promise<RecurringExpense[]> {
    const entries = await database.getAllAsync<RecurringExpense>(
        `SELECT id, clientId, vehicleId, category, amount, periodMonths, startDate, nextDueDate, description, active
         FROM recurring_expenses WHERE vehicleId = ? ORDER BY active DESC, startDate DESC, id DESC`,
        vehicleId,
    );
    return entries.map(normalizeRecurringExpense);
}

export async function updateRecurringExpense(entry: RecurringExpense, database: SQLite.SQLiteDatabase = db): Promise<RecurringExpense> {
    const id = requirePersistedLocalId(entry.id, 'Recurring expense');
    const clientId = await findRecurringExpenseClientId(id, database);
    await database.runAsync(
        `UPDATE recurring_expenses
         SET vehicleId = ?, category = ?, amount = ?, periodMonths = ?, startDate = ?, nextDueDate = ?, description = ?, active = ?
         WHERE id = ?`,
        entry.vehicleId, entry.category, entry.amount, entry.periodMonths, entry.startDate,
        entry.nextDueDate ?? null, entry.description ?? null, entry.active ? 1 : 0, id,
    );
    return { ...entry, clientId };
}

export async function setRecurringExpenseActive(id: number, active: boolean, database: SQLite.SQLiteDatabase = db): Promise<string> {
    const clientId = await findRecurringExpenseClientId(id, database);
    await database.runAsync(`UPDATE recurring_expenses SET active = ? WHERE id = ?`, active ? 1 : 0, id);
    return clientId;
}

async function findRecurringExpenseClientId(id: number, database: SQLite.SQLiteDatabase): Promise<string> {
    const entry = await database.getFirstAsync<Pick<RecurringExpense, 'clientId'>>(
        `SELECT clientId FROM recurring_expenses WHERE id = ?`, id,
    );
    return requirePersistedClientId(entry?.clientId, 'Recurring expense');
}

export async function deleteRecurringExpenseById(id: number, database: SQLite.SQLiteDatabase = db): Promise<string> {
    const clientId = await findRecurringExpenseClientId(id, database);
    await database.runAsync(`DELETE FROM recurring_expenses WHERE id = ?`, id);
    return clientId;
}

export async function deleteRecurringExpenseFromSync(clientId: string, database: SQLite.SQLiteDatabase = db): Promise<void> {
    await database.runAsync(`DELETE FROM recurring_expenses WHERE clientId = ?`, clientId);
}

export async function upsertRecurringExpenseFromSync(entry: RecurringExpenseSyncPayload, database: SQLite.SQLiteDatabase = db): Promise<void> {
    const vehicleId = await findVehicleIdByClientId(entry.vehicleClientId, database);
    await database.runAsync(
        `INSERT INTO recurring_expenses (clientId, vehicleId, category, amount, periodMonths, startDate, nextDueDate, description, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(clientId) DO UPDATE SET vehicleId = excluded.vehicleId, category = excluded.category, amount = excluded.amount,
           periodMonths = excluded.periodMonths, startDate = excluded.startDate, nextDueDate = excluded.nextDueDate,
           description = excluded.description, active = excluded.active`,
        entry.clientId, vehicleId, entry.category, entry.amount, entry.periodMonths, entry.startDate,
        entry.nextDueDate ?? null, entry.description ?? null, entry.active ? 1 : 0,
    );
}
