import type { CreateVehicleInput, UpdateVehicleInput } from '../models/Vehicle';
import { create } from 'zustand';
import { Vehicle } from '../models/Vehicle';
import {
  addVehicle,
  deleteVehicleById,
  getVehicles,
  updateVehicleCurrentOdometer,
  updateVehicle,
} from '../database/vehicleRepository';
import { removePendingVehicleUpserts } from '../database/syncRepository';
import { persistAndQueueSyncBatch } from '../services/sync/offlineSync';
import { toVehicleSyncPayload } from '../services/sync/syncPayload';
import { requireVehicleForSync } from '../services/sync/vehicleClientId';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';
import { initializeVehicleTrackingStartDate } from '../domain/vehicleTracking';

type VehicleState = {
  vehicles: Vehicle[];
  activeVehicleId: number | null;

  loadVehicles: () => Promise<void>;
  createVehicle: (vehicle: CreateVehicleInput) => Promise<Vehicle>;
  saveVehicle: (vehicle: UpdateVehicleInput) => Promise<Vehicle>;
  setActiveVehicle: (id: number) => void;
  syncVehicleOdometer: (vehicleId: number, odometer: number) => Promise<void>;
  deleteVehicle: (vehicleId: number) => Promise<void>;
};

export const useVehicleStore = create<VehicleState>(set => ({
  vehicles: [],
  activeVehicleId: null,

  loadVehicles: async () => {
    const vehicles = await getVehicles();

    set(state => ({
      vehicles,
      activeVehicleId:
        state.activeVehicleId && vehicles.some(item => item.id === state.activeVehicleId)
          ? state.activeVehicleId
          : (vehicles[0]?.id ?? null),
    }));
  },

  createVehicle: async vehicle => {
    const input = initializeVehicleTrackingStartDate({ ...vehicle, clientId: createClientId(SyncEntity.Vehicle) });
    const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
      const saved = await addVehicle(input, transaction);
      await queue(SyncEntity.Vehicle, SyncOperation.Upsert, toVehicleSyncPayload(saved));
      return { saved, vehicles: await getVehicles(transaction) };
    });
    set({ vehicles: result.vehicles, activeVehicleId: result.saved.id });
    return result.saved;
  },

  saveVehicle: async vehicle => {
    const result = await persistAndQueueSyncBatch(async (transaction, queue) => {
      const saved = await updateVehicle(vehicle, transaction);
      await queue(SyncEntity.Vehicle, SyncOperation.Upsert, toVehicleSyncPayload(saved));
      return { saved, vehicles: await getVehicles(transaction) };
    });
    set(state => ({ vehicles: result.vehicles, activeVehicleId: state.activeVehicleId ?? result.saved.id }));
    return result.saved;
  },

  setActiveVehicle: id => set({ activeVehicleId: id }),

  syncVehicleOdometer: async (vehicleId, odometer) => {
    const vehicles = await persistAndQueueSyncBatch(async (transaction, queue) => {
      await updateVehicleCurrentOdometer(vehicleId, odometer, transaction);
      const updated = await requireVehicleForSync(vehicleId, transaction);
      await queue(SyncEntity.Vehicle, SyncOperation.Upsert, toVehicleSyncPayload(updated));
      return getVehicles(transaction);
    });
    set(state => ({ vehicles, activeVehicleId: state.activeVehicleId ?? vehicleId }));
  },

  deleteVehicle: async vehicleId => {
    const vehicles = await persistAndQueueSyncBatch(async (transaction, queue) => {
      const vehicle = await requireVehicleForSync(vehicleId, transaction);
      await removePendingVehicleUpserts(vehicle.clientId, transaction);
      await deleteVehicleById(vehicleId, transaction);
      await queue(SyncEntity.Vehicle, SyncOperation.Delete, { clientId: vehicle.clientId });
      return getVehicles(transaction);
    });
    set(state => ({
      vehicles,
      activeVehicleId: state.activeVehicleId === vehicleId ? (vehicles[0]?.id ?? null) : state.activeVehicleId,
    }));
  },
}));
