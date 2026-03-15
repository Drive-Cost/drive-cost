import { create } from "zustand";
import {
  addMaintenanceEntry,
  getMaintenanceEntries,
} from "../database/maintanceRepository";
import { MaintenanceEntry } from "../models/MaintenanceEntry";
import { queueSyncJob } from "../services/offlineSync";

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
    await addMaintenanceEntry(entry);
    await queueSyncJob("maintenance_entry", "create", {
      ...entry,
      clientId: `maintenance-${entry.vehicleId}-${entry.date}`,
    });
    const entries = await getMaintenanceEntries(entry.vehicleId);
    set({ maintenanceEntries: entries });
  },
}));
