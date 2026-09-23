import { Vehicle } from '../../models/Vehicle';

export function getActiveVehicle(vehicles: readonly Vehicle[], activeVehicleId: number | null): Vehicle | undefined {
    return vehicles.find((vehicle) => vehicle.id === activeVehicleId);
}
