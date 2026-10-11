import { recordEntry } from '../services/entries/recordEntry';
import { useVehicleStore } from './vehicleStore';
import type { CreateChargingEntryInput } from '../models/ChargingEntry';
import { create } from 'zustand';
import { ChargingEntry } from '../models/ChargingEntry';
import { addChargingEntry, deleteChargingEntryById, getChargingEntries } from '../database/chargingRepository';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toChargingEntrySyncPayload } from '../services/sync/syncPayload';

type ChargingState = {
  chargingEntries: ChargingEntry[];
  loadChargingEntries: (vehicleId: number) => Promise<void>;
  createChargingEntry: (entry: CreateChargingEntryInput) => Promise<ChargingEntry>;
  deleteChargingEntry: (entryId: number, vehicleId: number) => Promise<void>;
};

export const useChargingStore = create<ChargingState>(set => ({
  chargingEntries: [],
  loadChargingEntries: async vehicleId => set({ chargingEntries: await getChargingEntries(vehicleId) }),
  createChargingEntry: async entry => {
    const entryToCreate = { ...entry, clientId: createClientId(SyncEntity.ChargingEntry) };
    const saved = await recordEntry(
      SyncEntity.ChargingEntry,
      entry,
      transaction => addChargingEntry(entryToCreate, transaction),
      getChargingEntries,
      toChargingEntrySyncPayload
    );
    set({ chargingEntries: saved.entries });
    useVehicleStore.setState({ vehicles: saved.vehicles });
    return saved.entry;
  },
  deleteChargingEntry: async (entryId, vehicleId) => {
    await persistAndQueueSync(SyncEntity.ChargingEntry, SyncOperation.Delete, async transaction => ({
      clientId: await deleteChargingEntryById(entryId, transaction),
    }));
    set({ chargingEntries: await getChargingEntries(vehicleId) });
  },
}));
