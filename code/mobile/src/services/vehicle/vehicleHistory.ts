import { ChargingEntry } from '../../models/ChargingEntry';
import { FuelEntry } from '../../models/FuelEntry';
import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { ExpenseEntry } from '../../models/ExpenseEntry';
import { Vehicle } from '../../models/Vehicle';
import { getEnergyEntries } from './energyEntries';
import { getEnergyEventTitle, getEnergyUnitLabel } from './vehicleProfile';
import { getExpenseCategoryLabel } from './expenseCopy';

const HistoryEntity = { Fuel: 'fuel', Charging: 'charging', Maintenance: 'maintenance', Expense: 'expense' } as const;

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
    chargingEntries: ChargingEntry[] = [],
    expenseEntries: ExpenseEntry[] = [],
): VehicleHistoryEvent[] {
    return [
        ...getEnergyEntries(vehicle, fuelEntries, chargingEntries).map((entry) => ({
            id: historyEventId(
                entry.source === 'charging' ? HistoryEntity.Charging : HistoryEntity.Fuel,
                entry.id,
                entry.date,
                entry.odometer,
            ),
            title: getEnergyEventTitle(vehicle),
            amount: entry.amount,
            detail: `${entry.quantity.toFixed(1)} ${getEnergyUnitLabel(vehicle)} • ${entry.odometer.toLocaleString()} km`,
            date: entry.date,
        })),
        ...maintenanceEntries
            .filter((entry) => entry.vehicleId === vehicle.id)
            .map((entry) => ({
                id: historyEventId(HistoryEntity.Maintenance, entry.id, entry.date, entry.odometer),
                title: entry.type || 'Maintenance',
                amount: entry.cost,
                detail: `${entry.description || 'Service entry'} • ${entry.odometer.toLocaleString()} km`,
                date: entry.date,
            })),
        ...expenseEntries
            .filter((entry) => entry.vehicleId === vehicle.id)
            .map((entry) => ({
                id: historyEventId(HistoryEntity.Expense, entry.id, entry.date, entry.odometer),
                title: getExpenseCategoryLabel(entry.category),
                amount: entry.totalPaid,
                detail: [entry.description || 'Ownership expense', entry.odometer === undefined ? null : `${entry.odometer.toLocaleString()} km`]
                    .filter(Boolean)
                    .join(' • '),
                date: entry.date,
            })),
    ].sort((left, right) => right.date.localeCompare(left.date));
}

function historyEventId(entityType: HistoryEntity, id: number | undefined, date: string, odometer?: number): string {
    return `${entityType}-${id ?? `${date}-${odometer ?? 'no-odometer'}`}`;
}
