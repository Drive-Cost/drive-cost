import { create } from 'zustand';
import { addFuelEntry, getFuelEntries } from '../database/fuelRepository';
import { FuelEntry } from '../models/FuelEntry';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toFuelEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity } from '../domain/sync';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';

interface FuelState {
    fuelEntries: FuelEntry[];
    loadFuelEntries: (vehicleId: number) => Promise<void>;
    createFuelEntry: (entry: FuelEntry) => Promise<void>;
}

export const useFuelStore = create<FuelState>((set) => ({
    fuelEntries: [],

    loadFuelEntries: async (vehicleId) => {
        const entries = await getFuelEntries(vehicleId);
        set({ fuelEntries: entries });
    },

    createFuelEntry: async (entry) => {
        const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.FuelEntry) };
        await persistAndQueueSync(SyncEntity.FuelEntry, async (transaction) => {
            const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
            await addFuelEntry(entryToCreate, transaction);
            return toFuelEntrySyncPayload(entryToCreate, vehicleClientId);
        });
        const entries = await getFuelEntries(entry.vehicleId);
        set({ fuelEntries: entries });
    },
}));
