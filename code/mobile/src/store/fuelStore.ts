import { create } from 'zustand';
import { addFuelEntry, deleteFuelEntryById, getFuelEntries } from '../database/fuelRepository';
import { FuelEntry } from '../models/FuelEntry';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toFuelEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';

interface FuelState {
    fuelEntries: FuelEntry[];
    loadFuelEntries: (vehicleId: number) => Promise<void>;
    createFuelEntry: (entry: FuelEntry) => Promise<void>;
    deleteFuelEntry: (entryId: number, vehicleId: number) => Promise<void>;
}

export const useFuelStore = create<FuelState>((set) => ({
    fuelEntries: [],

    loadFuelEntries: async (vehicleId) => {
        const entries = await getFuelEntries(vehicleId);
        set({ fuelEntries: entries });
    },

    createFuelEntry: async (entry) => {
        const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.FuelEntry) };
        await persistAndQueueSync(SyncEntity.FuelEntry, SyncOperation.Upsert, async (transaction) => {
            const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
            await addFuelEntry(entryToCreate, transaction);
            return toFuelEntrySyncPayload(entryToCreate, vehicleClientId);
        });
        const entries = await getFuelEntries(entry.vehicleId);
        set({ fuelEntries: entries });
    },

    deleteFuelEntry: async (entryId, vehicleId) => {
        await persistAndQueueSync(SyncEntity.FuelEntry, SyncOperation.Delete, async (transaction) => {
            const clientId = await deleteFuelEntryById(entryId, transaction);
            return { clientId };
        });
        set({ fuelEntries: await getFuelEntries(vehicleId) });
    },
}));
