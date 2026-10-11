import { recordEntry } from '../services/entries/recordEntry';
import { useVehicleStore } from './vehicleStore';
import type { CreateMaintenanceEntryInput, UpdateMaintenanceEntryInput } from '../models/MaintenanceEntry';
import { create } from 'zustand';
import {
  addMaintenanceEntry,
  deleteMaintenanceEntryById,
  getMaintenanceEntries,
  updateMaintenanceEntry,
} from '../database/maintenanceRepository';
import { MaintenanceEntry } from '../models/MaintenanceEntry';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toMaintenanceEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';

type MaintenanceState = {
  maintenanceEntries: MaintenanceEntry[];
  loadMaintenanceEntries: (vehicleId: number) => Promise<void>;
  createMaintenanceEntry: (entry: CreateMaintenanceEntryInput) => Promise<MaintenanceEntry>;
  updateMaintenanceEntry: (entry: UpdateMaintenanceEntryInput) => Promise<MaintenanceEntry>;
  deleteMaintenanceEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useMaintenanceStore = create<MaintenanceState>(set => ({
  maintenanceEntries: [],

  loadMaintenanceEntries: async vehicleId => {
    const entries = await getMaintenanceEntries(vehicleId);
    set({ maintenanceEntries: entries });
  },

  createMaintenanceEntry: async entry => {
    const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.MaintenanceEntry) };
    const saved = await recordEntry(
      SyncEntity.MaintenanceEntry,
      entry,
      transaction => addMaintenanceEntry(entryToCreate, transaction),
      getMaintenanceEntries,
      toMaintenanceEntrySyncPayload
    );
    set({ maintenanceEntries: saved.entries });
    useVehicleStore.setState({ vehicles: saved.vehicles });
    return saved.entry;
  },

  updateMaintenanceEntry: async entry => {
    const saved = await recordEntry(
      SyncEntity.MaintenanceEntry,
      entry,
      transaction => updateMaintenanceEntry(entry, transaction),
      getMaintenanceEntries,
      toMaintenanceEntrySyncPayload
    );
    set({ maintenanceEntries: saved.entries });
    useVehicleStore.setState({ vehicles: saved.vehicles });
    return saved.entry;
  },

  deleteMaintenanceEntry: async (entryId, vehicleId) => {
    await persistAndQueueSync(SyncEntity.MaintenanceEntry, SyncOperation.Delete, async transaction => {
      const clientId = await deleteMaintenanceEntryById(entryId, transaction);
      return { clientId };
    });
    set({ maintenanceEntries: await getMaintenanceEntries(vehicleId) });
  },
}));
