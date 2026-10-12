import { getDatasetGeneration, assertDatasetCurrent } from '../services/app/datasetContext';
import { createVehicleEntryLoader, mergeVehicleEntries } from './vehicleEntryLoader';
import type { VehicleLoadStates } from './vehicleEntryLoader';
import { deleteEntry } from '../services/entries/deleteEntry';
import { recordEntry } from '../services/entries/recordEntry';
import { useVehicleStore } from './vehicleStore';
import type { CreateChargingEntryInput } from '../models/ChargingEntry';
import { create } from 'zustand';
import { ChargingEntry } from '../models/ChargingEntry';
import { addChargingEntry, deleteChargingEntryById, getChargingEntries } from '../database/chargingRepository';
import { createClientId } from '../domain/identity';
import { SyncEntity } from '../domain/sync';
import { toChargingEntrySyncPayload } from '../services/sync/syncPayload';

type ChargingState = {
  chargingEntries: ChargingEntry[];
  loadStates: VehicleLoadStates;
  loadChargingEntries: (vehicleId: number) => Promise<void>;
  createChargingEntry: (entry: CreateChargingEntryInput) => Promise<ChargingEntry>;
  deleteChargingEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useChargingStore = create<ChargingState>(set => {
  const loader = createVehicleEntryLoader(
    getChargingEntries,
    (vehicleId, entries) =>
      set(state => ({ chargingEntries: mergeVehicleEntries(state.chargingEntries, vehicleId, entries) })),
    (vehicleId, loadState) => set(state => ({ loadStates: { ...state.loadStates, [vehicleId]: loadState } }))
  );
  return {
    chargingEntries: [],
    loadStates: {},
    loadChargingEntries: loader.load,
    createChargingEntry: async entry => {
      const dataset = getDatasetGeneration();
      const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.ChargingEntry) };
      const saved = await recordEntry(
        SyncEntity.ChargingEntry,
        entry,
        transaction => addChargingEntry(entryToCreate, transaction),
        getChargingEntries,
        toChargingEntrySyncPayload
      );
      assertDatasetCurrent(dataset);
      loader.publish(entry.vehicleId, saved.entries);
      useVehicleStore.setState({ vehicles: saved.vehicles });
      return saved.entry;
    },
    deleteChargingEntry: async (entryId, vehicleId) => {
      const dataset = getDatasetGeneration();
      const entries = await deleteEntry(
        SyncEntity.ChargingEntry,
        entryId,
        vehicleId,
        deleteChargingEntryById,
        getChargingEntries
      );
      assertDatasetCurrent(dataset);
      loader.publish(vehicleId, entries);
    },
  };
});
