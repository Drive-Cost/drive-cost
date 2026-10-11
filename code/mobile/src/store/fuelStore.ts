import { createVehicleEntryLoader, mergeVehicleEntries } from './vehicleEntryLoader';
import type { VehicleLoadStates } from './vehicleEntryLoader';
import { deleteEntry } from '../services/entries/deleteEntry';
import { recordEntry } from '../services/entries/recordEntry';
import { useVehicleStore } from './vehicleStore';
import type { CreateFuelEntryInput, UpdateFuelEntryInput } from '../models/FuelEntry';
import { create } from 'zustand';
import { addFuelEntry, deleteFuelEntryById, getFuelEntries, updateFuelEntry } from '../database/fuelRepository';
import { FuelEntry } from '../models/FuelEntry';
import { toFuelEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity } from '../domain/sync';

type FuelState = {
  fuelEntries: FuelEntry[];
  loadStates: VehicleLoadStates;
  loadFuelEntries: (vehicleId: number) => Promise<void>;
  createFuelEntry: (entry: CreateFuelEntryInput) => Promise<FuelEntry>;
  updateFuelEntry: (entry: UpdateFuelEntryInput) => Promise<FuelEntry>;
  deleteFuelEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useFuelStore = create<FuelState>(set => {
  const loader = createVehicleEntryLoader(
    getFuelEntries,
    (vehicleId, entries) => set(state => ({ fuelEntries: mergeVehicleEntries(state.fuelEntries, vehicleId, entries) })),
    (vehicleId, loadState) => set(state => ({ loadStates: { ...state.loadStates, [vehicleId]: loadState } }))
  );
  return {
    fuelEntries: [],
    loadStates: {},

    loadFuelEntries: loader.load,

    createFuelEntry: async entry => {
      const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.FuelEntry) };
      const saved = await recordEntry(
        SyncEntity.FuelEntry,
        entry,
        transaction => addFuelEntry(entryToCreate, transaction),
        getFuelEntries,
        toFuelEntrySyncPayload
      );
      loader.publish(entry.vehicleId, saved.entries);
      useVehicleStore.setState({ vehicles: saved.vehicles });
      return saved.entry;
    },

    updateFuelEntry: async entry => {
      const saved = await recordEntry(
        SyncEntity.FuelEntry,
        entry,
        transaction => updateFuelEntry(entry, transaction),
        getFuelEntries,
        toFuelEntrySyncPayload
      );
      loader.publish(entry.vehicleId, saved.entries);
      useVehicleStore.setState({ vehicles: saved.vehicles });
      return saved.entry;
    },

    deleteFuelEntry: async (entryId, vehicleId) => {
      const entries = await deleteEntry(SyncEntity.FuelEntry, entryId, vehicleId, deleteFuelEntryById, getFuelEntries);
      loader.publish(vehicleId, entries);
    },
  };
});
