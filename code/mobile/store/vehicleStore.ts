import { create } from 'zustand';
import { Vehicle } from '../src/models/Vehicle';

interface VehicleState {
    vehicles: Vehicle[];
    addVehicle: (vehicle: Vehicle) => void;
}

export const useVehicleStore = create<VehicleState>((set) => ({
    vehicles: [],

    addVehicle: (vehicle) => set((state) => ({ vehicles: [...state.vehicles, vehicle] })),
}));
