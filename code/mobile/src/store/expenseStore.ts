import type { CreateExpenseEntryInput, UpdateExpenseEntryInput } from '../models/ExpenseEntry';
import { create } from 'zustand';
import {
  addExpenseEntry,
  deleteExpenseEntryById,
  getExpenseEntries,
  updateExpenseEntry,
} from '../database/expenseRepository';
import { ExpenseEntry } from '../models/ExpenseEntry';
import { persistAndQueueSync, persistAndQueueSyncBatch } from '../services/sync/offlineSync';
import { toExpenseEntrySyncPayload } from '../services/sync/syncPayload';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';

type ExpenseState = {
  expenseEntries: ExpenseEntry[];
  loadExpenseEntries: (vehicleId: number) => Promise<void>;
  createExpenseEntry: (entry: CreateExpenseEntryInput) => Promise<ExpenseEntry>;
  updateExpenseEntry: (entry: UpdateExpenseEntryInput) => Promise<ExpenseEntry>;
  deleteExpenseEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useExpenseStore = create<ExpenseState>(set => ({
  expenseEntries: [],
  loadExpenseEntries: async vehicleId => set({ expenseEntries: await getExpenseEntries(vehicleId) }),
  createExpenseEntry: async entry => {
    const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.ExpenseEntry) };
    const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
      const saved = await addExpenseEntry(entryToCreate, transaction);
      const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
      await queue(SyncEntity.ExpenseEntry, SyncOperation.Upsert, toExpenseEntrySyncPayload(saved, vehicleClientId));
      return { saved, entries: await getExpenseEntries(entry.vehicleId, transaction) };
    });
    set({ expenseEntries: result.entries });
    return result.saved;
  },
  updateExpenseEntry: async entry => {
    const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
      const saved = await updateExpenseEntry(entry, transaction);
      const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
      await queue(SyncEntity.ExpenseEntry, SyncOperation.Upsert, toExpenseEntrySyncPayload(saved, vehicleClientId));
      return { saved, entries: await getExpenseEntries(entry.vehicleId, transaction) };
    });
    set({ expenseEntries: result.entries });
    return result.saved;
  },
  deleteExpenseEntry: async (entryId, vehicleId) => {
    await persistAndQueueSync(SyncEntity.ExpenseEntry, SyncOperation.Delete, async transaction => ({
      clientId: await deleteExpenseEntryById(entryId, transaction),
    }));
    set({ expenseEntries: await getExpenseEntries(vehicleId) });
  },
}));
