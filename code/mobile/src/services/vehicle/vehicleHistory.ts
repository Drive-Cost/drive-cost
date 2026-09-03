import { FuelEntry } from '../../models/FuelEntry';
import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { Vehicle } from '../../models/Vehicle';
import { getEnergyEventTitle, getEnergyUnitLabel } from './vehicleProfile';

const HistoryEntity = { Fuel: 'fuel', Maintenance: 'maintenance' } as const;

type HistoryEntity = (typeof HistoryEntity)[keyof typeof HistoryEntity];

export interface VehicleHistoryEvent {
    id: string;
    title: string;
    amount: number;
    detail: string;
    date: string;
}

export function buildVehicleHistory(
    vehicle: Vehicle,
    fuelEntries: FuelEntry[],
    maintenanceEntries: MaintenanceEntry[],
): VehicleHistoryEvent[] {
    return [
        ...fuelEntries.map((entry) => ({
            id: historyEventId(HistoryEntity.Fuel, entry.id, entry.date, entry.odometer),
            title: getEnergyEventTitle(vehicle),
            amount: entry.price,
            detail: `${entry.liters.toFixed(1)} ${getEnergyUnitLabel(vehicle)} • ${entry.odometer.toLocaleString()} km`,
            date: entry.date,
        })),
        ...maintenanceEntries.map((entry) => ({
            id: historyEventId(HistoryEntity.Maintenance, entry.id, entry.date, entry.odometer),
            title: entry.type || 'Maintenance',
            amount: entry.cost,
            detail: `${entry.description || 'Service entry'} • ${entry.odometer.toLocaleString()} km`,
            date: entry.date,
        })),
    ].sort((left, right) => right.date.localeCompare(left.date));
}

function historyEventId(entityType: HistoryEntity, id: number | undefined, date: string, odometer: number): string {
    return `${entityType}-${id ?? `${date}-${odometer}`}`;
}
