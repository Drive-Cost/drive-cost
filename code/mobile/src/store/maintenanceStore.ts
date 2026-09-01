import { create } from 'zustand';
import { addMaintenanceEntry, getMaintenanceEntries } from '../database/maintenanceRepository';
import { MaintenanceEntry } from '../models/MaintenanceEntry';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toMaintenanceEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity } from '../domain/sync';
import { requireVehicleClientId } from '../services/sync/vehicleClientId';

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
        await persistAndQueueSync(SyncEntity.MaintenanceEntry, async (transaction) => {
            const vehicleClientId = await requireVehicleClientId(entry.vehicleId, transaction);
            await addMaintenanceEntry(entryToCreate, transaction);
            return toMaintenanceEntrySyncPayload(entryToCreate, vehicleClientId);
        });
        const entries = await getMaintenanceEntries(entry.vehicleId);
        set({ maintenanceEntries: entries });
    },
}));
