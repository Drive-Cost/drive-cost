import { create } from 'zustand';
import { createClientId } from '../domain/identity';
import { RecurringExpense } from '../models/RecurringExpense';
import { addRecurringExpense, deleteRecurringExpenseById, getRecurringExpenses, setRecurringExpenseActive, updateRecurringExpense } from '../database/recurringExpenseRepository';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toRecurringExpenseSyncPayload } from '../services/sync/syncPayload';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';
import { SyncEntity, SyncOperation } from '../domain/sync';

interface RecurringExpenseState {
    recurringExpenses: RecurringExpense[];
    loadRecurringExpenses(vehicleId: number): Promise<void>;
    createRecurringExpense(entry: RecurringExpense): Promise<void>;
    updateRecurringExpense(entry: RecurringExpense): Promise<void>;
    setRecurringExpenseActive(id: number, vehicleId: number, active: boolean): Promise<void>;
    deleteRecurringExpense(id: number, vehicleId: number): Promise<void>;
}

export const useRecurringExpenseStore = create<RecurringExpenseState>((set) => ({
    recurringExpenses: [],
    loadRecurringExpenses: async (vehicleId) => set({ recurringExpenses: await getRecurringExpenses(vehicleId) }),
    createRecurringExpense: async (entry) => {
        const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.RecurringExpense) };
        await persistAndQueueSync(SyncEntity.RecurringExpense, SyncOperation.Upsert, async (transaction) => {
            await addRecurringExpense(entryToCreate, transaction);
            return toRecurringExpenseSyncPayload(entryToCreate, await requireVehicleClientId(entry.vehicleId, transaction));
        });
        set({ recurringExpenses: await getRecurringExpenses(entry.vehicleId) });
    },
    updateRecurringExpense: async (entry) => {
        await persistAndQueueSync(SyncEntity.RecurringExpense, SyncOperation.Upsert, async (transaction) => {
            const saved = await updateRecurringExpense(entry, transaction);
            return toRecurringExpenseSyncPayload(saved, await requireVehicleClientId(entry.vehicleId, transaction));
        });
        set({ recurringExpenses: await getRecurringExpenses(entry.vehicleId) });
    },
    setRecurringExpenseActive: async (id, vehicleId, active) => {
        await persistAndQueueSync(SyncEntity.RecurringExpense, SyncOperation.Upsert, async (transaction) => {
            await setRecurringExpenseActive(id, active, transaction);
            const entries = await getRecurringExpenses(vehicleId, transaction);
            const updated = entries.find((entry) => entry.id === id);
            if (!updated) throw new Error('Recurring expense not found.');
            return toRecurringExpenseSyncPayload(updated, await requireVehicleClientId(vehicleId, transaction));
        });
        set({ recurringExpenses: await getRecurringExpenses(vehicleId) });
    },
    deleteRecurringExpense: async (id, vehicleId) => {
        await persistAndQueueSync(SyncEntity.RecurringExpense, SyncOperation.Delete, async (transaction) => ({ clientId: await deleteRecurringExpenseById(id, transaction) }));
        set({ recurringExpenses: await getRecurringExpenses(vehicleId) });
    },
}));
