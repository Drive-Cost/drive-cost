import { create } from "zustand";
import { Vehicle } from "../models/Vehicle";
import {
  addVehicle,
  getVehicles,
  updateVehicleCurrentOdometer,
  updateVehicle,
} from "../database/vehicleRepository";
import { queueSyncJob } from "../services/offlineSync";

interface VehicleState {
  vehicles: Vehicle[];
  activeVehicleId: number | null;

  loadVehicles: () => Promise<void>;
  createVehicle: (vehicle: Vehicle) => Promise<void>;
  saveVehicle: (vehicle: Vehicle) => Promise<void>;
  setActiveVehicle: (id: number) => void;
  syncVehicleOdometer: (vehicleId: number, odometer: number) => Promise<void>;
}

export const useVehicleStore = create<VehicleState>((set) => ({
  vehicles: [],
  activeVehicleId: null,

  loadVehicles: async () => {
    const vehicles = await getVehicles();

    set({
      vehicles,
      activeVehicleId: vehicles.length ? vehicles[0].id : null,
    });
  },

  createVehicle: async (vehicle) => {
    await addVehicle(vehicle);
    await queueSyncJob("vehicle", "upsert", {
      ...vehicle,
      clientId: `${vehicle.brand}-${vehicle.model}-${Date.now()}`,
    });
    const vehicles = await getVehicles();

    set({
      vehicles,
      activeVehicleId: vehicles[vehicles.length - 1].id,
    });
  },

  saveVehicle: async (vehicle) => {
    await updateVehicle(vehicle);
    await queueSyncJob("vehicle", "upsert", {
      ...vehicle,
      clientId: `vehicle-${vehicle.id}`,
    });
    const vehicles = await getVehicles();

    set((state) => ({
      vehicles,
      activeVehicleId: state.activeVehicleId ?? vehicle.id ?? null,
    }));
  },

  setActiveVehicle: (id) => set({ activeVehicleId: id }),

  syncVehicleOdometer: async (vehicleId, odometer) => {
    await updateVehicleCurrentOdometer(vehicleId, odometer);
    const vehicles = await getVehicles();

    set((state) => ({
      vehicles,
      activeVehicleId: state.activeVehicleId ?? vehicleId,
    }));
  },
}));
