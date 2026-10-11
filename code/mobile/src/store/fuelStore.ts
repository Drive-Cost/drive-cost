import { recordEntry } from '../services/entries/recordEntry';
import { useVehicleStore } from './vehicleStore';
import type { CreateFuelEntryInput, UpdateFuelEntryInput } from '../models/FuelEntry';
import { create } from 'zustand';
import { addFuelEntry, deleteFuelEntryById, getFuelEntries, updateFuelEntry } from '../database/fuelRepository';
import { FuelEntry } from '../models/FuelEntry';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toFuelEntrySyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';

type FuelState = {
  fuelEntries: FuelEntry[];
  loadFuelEntries: (vehicleId: number) => Promise<void>;
  createFuelEntry: (entry: CreateFuelEntryInput) => Promise<FuelEntry>;
  updateFuelEntry: (entry: UpdateFuelEntryInput) => Promise<FuelEntry>;
  deleteFuelEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useFuelStore = create<FuelState>(set => ({
  fuelEntries: [],

  loadFuelEntries: async vehicleId => {
    const entries = await getFuelEntries(vehicleId);
    set({ fuelEntries: entries });
  },

  createFuelEntry: async entry => {
    const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.FuelEntry) };
    const saved = await recordEntry(
      SyncEntity.FuelEntry,
      entry,
      transaction => addFuelEntry(entryToCreate, transaction),
      getFuelEntries,
      toFuelEntrySyncPayload
    );
    set({ fuelEntries: saved.entries });
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
    set({ fuelEntries: saved.entries });
    useVehicleStore.setState({ vehicles: saved.vehicles });
    return saved.entry;
  },

  deleteFuelEntry: async (entryId, vehicleId) => {
    await persistAndQueueSync(SyncEntity.FuelEntry, SyncOperation.Delete, async transaction => {
      const clientId = await deleteFuelEntryById(entryId, transaction);
      return { clientId };
    });
    set({ fuelEntries: await getFuelEntries(vehicleId) });
  },
}));
