import { create } from "zustand";
import { Vehicle } from "../models/Vehicle";
import {
  addVehicle,
  getVehicles,
  updateVehicleCurrentOdometer,
  updateVehicle,
} from "../database/vehicleRepository";
import { queueSyncJob } from "../services/offlineSync";
import { createClientId } from "../domain/identity";

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

    set((state) => ({
      vehicles,
      activeVehicleId:
        state.activeVehicleId && vehicles.some((item) => item.id === state.activeVehicleId)
          ? state.activeVehicleId
          : (vehicles[0]?.id ?? null),
    }));
  },

  createVehicle: async (vehicle) => {
    const vehicleToCreate = { ...vehicle, clientId: createClientId("vehicle") };
    await addVehicle(vehicleToCreate);
    await queueSyncJob("vehicle", "upsert", vehicleToCreate);
    const vehicles = await getVehicles();

    set({
      vehicles,
      activeVehicleId: vehicles[vehicles.length - 1].id,
    });
  },

  saveVehicle: async (vehicle) => {
    const vehicleToSave = {
      ...vehicle,
      clientId: vehicle.clientId ?? createClientId("vehicle"),
    };
    await updateVehicle(vehicleToSave);
    await queueSyncJob("vehicle", "upsert", vehicleToSave);
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

    const updatedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
    if (updatedVehicle) {
      await queueSyncJob("vehicle", "upsert", updatedVehicle);
    }

    set((state) => ({
      vehicles,
      activeVehicleId: state.activeVehicleId ?? vehicleId,
    }));
  },
}));
