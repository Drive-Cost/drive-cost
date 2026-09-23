import { create } from 'zustand';
import {
    addExpenseEntry,
    deleteExpenseEntryById,
    getExpenseEntries,
    updateExpenseEntry,
} from '../database/expenseRepository';
import { ExpenseEntry } from '../models/ExpenseEntry';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toExpenseEntrySyncPayload } from '../services/sync/syncPayload';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';

interface ExpenseState {
    expenseEntries: ExpenseEntry[];
    loadExpenseEntries(vehicleId: number): Promise<void>;
    createExpenseEntry(entry: ExpenseEntry): Promise<void>;
    updateExpenseEntry(entry: ExpenseEntry): Promise<void>;
    deleteExpenseEntry(entryId: number, vehicleId: number): Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set) => ({
    expenseEntries: [],
    loadExpenseEntries: async (vehicleId) => set({ expenseEntries: await getExpenseEntries(vehicleId) }),
    createExpenseEntry: async (entry) => {
        const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.ExpenseEntry) };
        await persistAndQueueSync(SyncEntity.ExpenseEntry, SyncOperation.Upsert, async (transaction) => {
            const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
            await addExpenseEntry(entryToCreate, transaction);
            return toExpenseEntrySyncPayload(entryToCreate, vehicleClientId);
        });
        set({ expenseEntries: await getExpenseEntries(entry.vehicleId) });
    },
    updateExpenseEntry: async (entry) => {
        await persistAndQueueSync(SyncEntity.ExpenseEntry, SyncOperation.Upsert, async (transaction) => {
            const saved = await updateExpenseEntry(entry, transaction);
            return toExpenseEntrySyncPayload(saved, await requireVehicleClientId(entry.vehicleId, transaction));
        });
        set({ expenseEntries: await getExpenseEntries(entry.vehicleId) });
    },
    deleteExpenseEntry: async (entryId, vehicleId) => {
        await persistAndQueueSync(SyncEntity.ExpenseEntry, SyncOperation.Delete, async (transaction) => ({
            clientId: await deleteExpenseEntryById(entryId, transaction),
        }));
        set({ expenseEntries: await getExpenseEntries(vehicleId) });
    },
}));
