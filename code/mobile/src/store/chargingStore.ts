import { create } from 'zustand';
import { ChargingEntry } from '../models/ChargingEntry';
import { addChargingEntry, deleteChargingEntryById, getChargingEntries } from '../database/chargingRepository';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toChargingEntrySyncPayload } from '../services/sync/syncPayload';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';

interface ChargingState {
    chargingEntries: ChargingEntry[];
    loadChargingEntries(vehicleId: number): Promise<void>;
    createChargingEntry(entry: ChargingEntry): Promise<void>;
    deleteChargingEntry(entryId: number, vehicleId: number): Promise<void>;
}

export const useChargingStore = create<ChargingState>((set) => ({
    chargingEntries: [],
    loadChargingEntries: async (vehicleId) => set({ chargingEntries: await getChargingEntries(vehicleId) }),
    createChargingEntry: async (entry) => {
        const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.ChargingEntry) };
        await persistAndQueueSync(SyncEntity.ChargingEntry, SyncOperation.Upsert, async (transaction) => {
            const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
            await addChargingEntry(entryToCreate, transaction);
            return toChargingEntrySyncPayload(entryToCreate, vehicleClientId);
        });
        set({ chargingEntries: await getChargingEntries(entry.vehicleId) });
    },
    deleteChargingEntry: async (entryId, vehicleId) => {
        await persistAndQueueSync(SyncEntity.ChargingEntry, SyncOperation.Delete, async (transaction) => ({
            clientId: await deleteChargingEntryById(entryId, transaction),
        }));
        set({ chargingEntries: await getChargingEntries(vehicleId) });
    },
}));
