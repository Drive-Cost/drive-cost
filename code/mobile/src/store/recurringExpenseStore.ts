import type { CreateRecurringExpenseInput, UpdateRecurringExpenseInput } from '../models/RecurringExpense';
import { create } from 'zustand';
import { createClientId } from '../domain/identity';
import { RecurringExpense } from '../models/RecurringExpense';
import {
  addRecurringExpense,
  deleteRecurringExpenseById,
  getRecurringExpenses,
  setRecurringExpenseActive,
  updateRecurringExpense,
} from '../database/recurringExpenseRepository';
import { persistAndQueueSync, persistAndQueueSyncBatch } from '../services/sync/offlineSync';
import { toRecurringExpenseSyncPayload } from '../services/sync/syncPayload';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';
import { SyncEntity, SyncOperation } from '../domain/sync';

type RecurringExpenseState = {
  recurringExpenses: RecurringExpense[];
  loadRecurringExpenses: (vehicleId: number) => Promise<void>;
  createRecurringExpense: (entry: CreateRecurringExpenseInput) => Promise<RecurringExpense>;
  updateRecurringExpense: (entry: UpdateRecurringExpenseInput) => Promise<RecurringExpense>;
  setRecurringExpenseActive: (id: number, vehicleId: number, active: boolean) => Promise<void>;
  deleteRecurringExpense: (id: number, vehicleId: number) => Promise<void>;
};

export const useRecurringExpenseStore = create<RecurringExpenseState>(set => ({
  recurringExpenses: [],
  loadRecurringExpenses: async vehicleId => set({ recurringExpenses: await getRecurringExpenses(vehicleId) }),
  createRecurringExpense: async entry => {
    const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.RecurringExpense) };
    const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
      const saved = await addRecurringExpense(entryToCreate, transaction);
      const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
      await queue(
        SyncEntity.RecurringExpense,
        SyncOperation.Upsert,
        toRecurringExpenseSyncPayload(saved, vehicleClientId)
      );
      return { saved, entries: await getRecurringExpenses(entry.vehicleId, transaction) };
    });
    set({ recurringExpenses: result.entries });
    return result.saved;
  },
  updateRecurringExpense: async entry => {
    const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
      const saved = await updateRecurringExpense(entry, transaction);
      const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
      await queue(
        SyncEntity.RecurringExpense,
        SyncOperation.Upsert,
        toRecurringExpenseSyncPayload(saved, vehicleClientId)
      );
      return { saved, entries: await getRecurringExpenses(entry.vehicleId, transaction) };
    });
    set({ recurringExpenses: result.entries });
    return result.saved;
  },
  setRecurringExpenseActive: async (id, vehicleId, active) => {
    const entries = await persistAndQueueSyncBatch(async (transaction, queue) => {
      await setRecurringExpenseActive(id, active, transaction);
      const snapshot = await getRecurringExpenses(vehicleId, transaction);
      const updated = snapshot.find(entry => entry.id === id);
      if (!updated) throw new Error('Recurring expense not found.');
      await queue(
        SyncEntity.RecurringExpense,
        SyncOperation.Upsert,
        toRecurringExpenseSyncPayload(updated, await requireVehicleClientId(vehicleId, transaction))
      );
      return snapshot;
    });
    set({ recurringExpenses: entries });
  },
  deleteRecurringExpense: async (id, vehicleId) => {
    await persistAndQueueSync(SyncEntity.RecurringExpense, SyncOperation.Delete, async transaction => ({
      clientId: await deleteRecurringExpenseById(id, transaction),
    }));
    set({ recurringExpenses: await getRecurringExpenses(vehicleId) });
  },
}));
