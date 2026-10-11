import { createVehicleEntryLoader, mergeVehicleEntries } from './vehicleEntryLoader';
import type { VehicleLoadStates } from './vehicleEntryLoader';
import { deleteEntry } from '../services/entries/deleteEntry';
import type { CreateExpenseEntryInput, UpdateExpenseEntryInput } from '../models/ExpenseEntry';
import { create } from 'zustand';
import {
  addExpenseEntry,
  deleteExpenseEntryById,
  getExpenseEntries,
  updateExpenseEntry,
} from '../database/expenseRepository';
import { ExpenseEntry } from '../models/ExpenseEntry';
import { persistAndQueueSyncBatch } from '../services/sync/offlineSync';
import { toExpenseEntrySyncPayload } from '../services/sync/syncPayload';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';

type ExpenseState = {
  expenseEntries: ExpenseEntry[];
  loadStates: VehicleLoadStates;
  loadExpenseEntries: (vehicleId: number) => Promise<void>;
  createExpenseEntry: (entry: CreateExpenseEntryInput) => Promise<ExpenseEntry>;
  updateExpenseEntry: (entry: UpdateExpenseEntryInput) => Promise<ExpenseEntry>;
  deleteExpenseEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useExpenseStore = create<ExpenseState>(set => {
  const loader = createVehicleEntryLoader(
    getExpenseEntries,
    (vehicleId, entries) =>
      set(state => ({ expenseEntries: mergeVehicleEntries(state.expenseEntries, vehicleId, entries) })),
    (vehicleId, loadState) => set(state => ({ loadStates: { ...state.loadStates, [vehicleId]: loadState } }))
  );
  return {
    expenseEntries: [],
    loadStates: {},
    loadExpenseEntries: loader.load,
    createExpenseEntry: async entry => {
      const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.ExpenseEntry) };
      const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
        const saved = await addExpenseEntry(entryToCreate, transaction);
        const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
        await queue(SyncEntity.ExpenseEntry, SyncOperation.Upsert, toExpenseEntrySyncPayload(saved, vehicleClientId));
        return { saved, entries: await getExpenseEntries(entry.vehicleId, transaction) };
      });
      loader.publish(entry.vehicleId, result.entries);
      return result.saved;
    },
    updateExpenseEntry: async entry => {
      const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
        const saved = await updateExpenseEntry(entry, transaction);
        const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
        await queue(SyncEntity.ExpenseEntry, SyncOperation.Upsert, toExpenseEntrySyncPayload(saved, vehicleClientId));
        return { saved, entries: await getExpenseEntries(entry.vehicleId, transaction) };
      });
      loader.publish(entry.vehicleId, result.entries);
      return result.saved;
    },
    deleteExpenseEntry: async (entryId, vehicleId) => {
      const entries = await deleteEntry(
        SyncEntity.ExpenseEntry,
        entryId,
        vehicleId,
        deleteExpenseEntryById,
        getExpenseEntries
      );
      loader.publish(vehicleId, entries);
    },
  };
});
