import { createVehicleEntryLoader, mergeVehicleEntries } from './vehicleEntryLoader';
import type { VehicleLoadStates } from './vehicleEntryLoader';
import { deleteEntry } from '../services/entries/deleteEntry';
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
import { toMaintenanceEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity } from '../domain/sync';

type MaintenanceState = {
  maintenanceEntries: MaintenanceEntry[];
  loadStates: VehicleLoadStates;
  loadMaintenanceEntries: (vehicleId: number) => Promise<void>;
  createMaintenanceEntry: (entry: CreateMaintenanceEntryInput) => Promise<MaintenanceEntry>;
  updateMaintenanceEntry: (entry: UpdateMaintenanceEntryInput) => Promise<MaintenanceEntry>;
  deleteMaintenanceEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useMaintenanceStore = create<MaintenanceState>(set => {
  const loader = createVehicleEntryLoader(
    getMaintenanceEntries,
    (vehicleId, entries) =>
      set(state => ({ maintenanceEntries: mergeVehicleEntries(state.maintenanceEntries, vehicleId, entries) })),
    (vehicleId, loadState) => set(state => ({ loadStates: { ...state.loadStates, [vehicleId]: loadState } }))
  );
  return {
    maintenanceEntries: [],
    loadStates: {},

    loadMaintenanceEntries: loader.load,

    createMaintenanceEntry: async entry => {
      const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.MaintenanceEntry) };
      const saved = await recordEntry(
        SyncEntity.MaintenanceEntry,
        entry,
        transaction => addMaintenanceEntry(entryToCreate, transaction),
        getMaintenanceEntries,
        toMaintenanceEntrySyncPayload
      );
      loader.publish(entry.vehicleId, saved.entries);
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
      loader.publish(entry.vehicleId, saved.entries);
      useVehicleStore.setState({ vehicles: saved.vehicles });
      return saved.entry;
    },

    deleteMaintenanceEntry: async (entryId, vehicleId) => {
      const entries = await deleteEntry(
        SyncEntity.MaintenanceEntry,
        entryId,
        vehicleId,
        deleteMaintenanceEntryById,
        getMaintenanceEntries
      );
      loader.publish(vehicleId, entries);
    },
  };
});
