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
import { persistAndQueueSync } from '../services/sync/offlineSync';
import { toVehicleSyncPayload } from '../services/sync/syncPayload';
import { requireVehicleForSync } from '../services/sync/vehicleClientId';
import { createClientId } from '../domain/identity';
import { SyncEntity, SyncOperation } from '../domain/sync';
import { initializeVehicleTrackingStartDate } from '../domain/vehicleTracking';

interface VehicleState {
    vehicles: Vehicle[];
    activeVehicleId: number | null;

    loadVehicles: () => Promise<void>;
    createVehicle: (vehicle: Omit<Vehicle, 'id' | 'clientId'>) => Promise<void>;
    saveVehicle: (vehicle: Vehicle) => Promise<void>;
    setActiveVehicle: (id: number) => void;
    syncVehicleOdometer: (vehicleId: number, odometer: number) => Promise<void>;
    deleteVehicle: (vehicleId: number) => Promise<void>;
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
        const vehicleToCreate = initializeVehicleTrackingStartDate({ ...vehicle, clientId: createClientId(SyncEntity.Vehicle) });
        await persistAndQueueSync(SyncEntity.Vehicle, SyncOperation.Upsert, async (transaction) => {
            await addVehicle(vehicleToCreate, transaction);
            return toVehicleSyncPayload(vehicleToCreate);
        });
        const vehicles = await getVehicles();

        const createdVehicle = vehicles.find((item) => item.clientId === vehicleToCreate.clientId);
        set({ vehicles, activeVehicleId: createdVehicle?.id ?? vehicles[vehicles.length - 1]?.id ?? null });
    },

    saveVehicle: async (vehicle) => {
        const vehicleToSave = { ...vehicle, clientId: vehicle.clientId ?? createClientId(SyncEntity.Vehicle) };
        await persistAndQueueSync(SyncEntity.Vehicle, SyncOperation.Upsert, async (transaction) => {
            await updateVehicle(vehicleToSave, transaction);
            return toVehicleSyncPayload(vehicleToSave);
        });
        const vehicles = await getVehicles();

        set((state) => ({ vehicles, activeVehicleId: state.activeVehicleId ?? vehicle.id ?? null }));
    },

    setActiveVehicle: (id) => set({ activeVehicleId: id }),

    syncVehicleOdometer: async (vehicleId, odometer) => {
        await persistAndQueueSync(SyncEntity.Vehicle, SyncOperation.Upsert, async (transaction) => {
            await updateVehicleCurrentOdometer(vehicleId, odometer, transaction);
            const updatedVehicle = await requireVehicleForSync(vehicleId, transaction);
            return toVehicleSyncPayload(updatedVehicle);
        });
        const vehicles = await getVehicles();

        set((state) => ({ vehicles, activeVehicleId: state.activeVehicleId ?? vehicleId }));
    },

    deleteVehicle: async (vehicleId) => {
        await persistAndQueueSync(SyncEntity.Vehicle, SyncOperation.Delete, async (transaction) => {
            const vehicle = await requireVehicleForSync(vehicleId, transaction);
            await removePendingVehicleUpserts(vehicle.clientId, transaction);
            await deleteVehicleById(vehicleId, transaction);
            return { clientId: vehicle.clientId };
        });
        const vehicles = await getVehicles();
        set((state) => ({
            vehicles,
            activeVehicleId: state.activeVehicleId === vehicleId ? (vehicles[0]?.id ?? null) : state.activeVehicleId,
        }));
    },
}));
