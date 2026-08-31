import { create } from 'zustand';
import { addFuelEntry, getFuelEntries } from '../database/fuelRepository';
import { FuelEntry } from '../models/FuelEntry';
import { queueSyncJob } from '../services/sync/offlineSync';
import { toFuelEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { getVehicleById } from '../database/vehicleRepository';
import { SyncEntity } from '../domain/sync';

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
        const vehicle = await getVehicleById(entry.vehicleId);

        if (!vehicle?.clientId) {
            throw new Error('The vehicle could not be prepared for sync.');
        }

        await addFuelEntry(entryToCreate);
        await queueSyncJob(SyncEntity.FuelEntry, toFuelEntrySyncPayload(entryToCreate, vehicle.clientId));
        const entries = await getFuelEntries(entry.vehicleId);
        set({ fuelEntries: entries });
    },
}));
