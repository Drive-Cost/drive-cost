import { create } from "zustand";
import { addFuelEntry, getFuelEntries } from "../database/fuelRepository";
import { FuelEntry } from "../models/FuelEntry";
import { queueSyncJob } from "../services/offlineSync";

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
    await addFuelEntry(entry);
    await queueSyncJob("fuel_entry", "create", {
      ...entry,
      clientId: `fuel-${entry.vehicleId}-${entry.date}`,
    });
    const entries = await getFuelEntries(entry.vehicleId);
    set({ fuelEntries: entries });
  },
}));
