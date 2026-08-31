import { create } from 'zustand';
import { addMaintenanceEntry, getMaintenanceEntries } from '../database/maintenanceRepository';
import { MaintenanceEntry } from '../models/MaintenanceEntry';
import { queueSyncJob } from '../services/sync/offlineSync';
import { toMaintenanceEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { getVehicleById } from '../database/vehicleRepository';
import { SyncEntity } from '../domain/sync';

interface MaintenanceState {
    maintenanceEntries: MaintenanceEntry[];
    loadMaintenanceEntries: (vehicleId: number) => Promise<void>;
    createMaintenanceEntry: (entry: MaintenanceEntry) => Promise<void>;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
    maintenanceEntries: [],

    loadMaintenanceEntries: async (vehicleId) => {
        const entries = await getMaintenanceEntries(vehicleId);
        set({ maintenanceEntries: entries });
    },

    createMaintenanceEntry: async (entry) => {
        const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.MaintenanceEntry) };
        const vehicle = await getVehicleById(entry.vehicleId);

        if (!vehicle?.clientId) {
            throw new Error('The vehicle could not be prepared for sync.');
        }

        await addMaintenanceEntry(entryToCreate);
        await queueSyncJob(SyncEntity.MaintenanceEntry, toMaintenanceEntrySyncPayload(entryToCreate, vehicle.clientId));
        const entries = await getMaintenanceEntries(entry.vehicleId);
        set({ maintenanceEntries: entries });
    },
}));
