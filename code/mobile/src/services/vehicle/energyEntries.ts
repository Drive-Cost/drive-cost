import { ChargingEntry } from '../../models/ChargingEntry';
import { FuelEntry } from '../../models/FuelEntry';
import { Vehicle } from '../../models/Vehicle';
import { isElectricVehicle } from './vehicleProfile';

export const EnergyEntrySource = {
    Fuel: 'fuel',
    Charging: 'charging',
    LegacyEvFuel: 'legacy-ev-fuel',
} as const;

export type EnergyEntrySource = (typeof EnergyEntrySource)[keyof typeof EnergyEntrySource];

export interface EnergyEntry {
    id?: number;
    clientId?: string;
    vehicleId: number;
    date: string;
    quantity: number;
    amount: number;
    odometer: number;
    source: EnergyEntrySource;
}

export function getEnergyEntries(
    vehicle: Vehicle,
    fuelEntries: FuelEntry[],
    chargingEntries: ChargingEntry[],
): EnergyEntry[] {
    const vehicleId = vehicle.id;
    const vehicleFuelEntries = fuelEntries.filter((entry) => entry.vehicleId === vehicleId);

    if (!isElectricVehicle(vehicle)) {
        return vehicleFuelEntries.map((entry) => toFuelEnergyEntry(entry, EnergyEntrySource.Fuel));
    }

    return [
        ...vehicleFuelEntries.map((entry) => toFuelEnergyEntry(entry, EnergyEntrySource.LegacyEvFuel)),
        ...chargingEntries
            .filter((entry) => entry.vehicleId === vehicleId)
            .map((entry) => ({
                id: entry.id,
                clientId: entry.clientId,
                vehicleId: entry.vehicleId,
                date: entry.date,
                quantity: entry.kWh,
                amount: entry.price,
                odometer: entry.odometer,
                source: EnergyEntrySource.Charging,
            })),
    ];
}

function toFuelEnergyEntry(
    entry: FuelEntry,
    source: typeof EnergyEntrySource.Fuel | typeof EnergyEntrySource.LegacyEvFuel,
): EnergyEntry {
    return {
        id: entry.id,
        clientId: entry.clientId,
        vehicleId: entry.vehicleId,
        date: entry.date,
        quantity: entry.liters,
        amount: entry.price,
        odometer: entry.odometer,
        source,
    };
}
