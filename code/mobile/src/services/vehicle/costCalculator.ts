import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { ExpenseEntry } from '../../models/ExpenseEntry';
import { EnergyEntry } from './energyEntries';

export function calculateCostPerKm(totalCost: number, totalDistance: number | null): number | null {
    if (totalDistance === null || !Number.isFinite(totalCost) || !Number.isFinite(totalDistance) || totalDistance <= 0) return null;
    return totalCost / totalDistance;
}

export function calculateTotalEnergyCost(entries: EnergyEntry[]) {
    return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function calculateTotalMaintenanceCost(entries: MaintenanceEntry[]) {
    return entries.reduce((sum, entry) => sum + entry.cost, 0);
}

export function calculateTotalOwnershipExpenseCost(entries: ExpenseEntry[]) {
    return entries.reduce((sum, entry) => sum + entry.totalPaid, 0);
}

export function formatCurrency(value: number) {
    return `EUR ${value.toFixed(2)}`;
}

export function formatCostPerKm(value: number | null) {
    if (value === null) return 'Unavailable';
    return `EUR ${value.toFixed(2)}/km`;
}
