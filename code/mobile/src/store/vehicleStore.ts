import { create } from 'zustand';
import { Vehicle } from '../models/Vehicle';
import { addVehicle, getVehicles, updateVehicleCurrentOdometer, updateVehicle } from '../database/vehicleRepository';
import { queueSyncJob } from '../services/sync/offlineSync';
import { toVehicleSyncPayload } from '../services/sync/syncPayload';
import { createClientId } from '../domain/identity';
import { SyncEntity } from '../domain/sync';

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
        const vehicleToCreate = { ...vehicle, clientId: createClientId(SyncEntity.Vehicle) };
        await addVehicle(vehicleToCreate);
        await queueSyncJob(SyncEntity.Vehicle, toVehicleSyncPayload(vehicleToCreate));
        const vehicles = await getVehicles();

        set({ vehicles, activeVehicleId: vehicles[vehicles.length - 1].id });
    },

    saveVehicle: async (vehicle) => {
        const vehicleToSave = { ...vehicle, clientId: vehicle.clientId ?? createClientId(SyncEntity.Vehicle) };
        await updateVehicle(vehicleToSave);
        await queueSyncJob(SyncEntity.Vehicle, toVehicleSyncPayload(vehicleToSave));
        const vehicles = await getVehicles();

        set((state) => ({ vehicles, activeVehicleId: state.activeVehicleId ?? vehicle.id ?? null }));
    },

    setActiveVehicle: (id) => set({ activeVehicleId: id }),

    syncVehicleOdometer: async (vehicleId, odometer) => {
        await updateVehicleCurrentOdometer(vehicleId, odometer);
        const vehicles = await getVehicles();

        const updatedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
        if (updatedVehicle) {
            await queueSyncJob(SyncEntity.Vehicle, toVehicleSyncPayload(updatedVehicle));
        }

        set((state) => ({ vehicles, activeVehicleId: state.activeVehicleId ?? vehicleId }));
    },
}));
