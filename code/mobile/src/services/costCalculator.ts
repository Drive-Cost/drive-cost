import { FuelEntry } from "../models/FuelEntry";
import { MaintenanceEntry } from "../models/MaintenanceEntry";

export function calculateCostPerKm(totalCost: number, totalDistance: number) {
  if (totalDistance === 0) return 0;
  return totalCost / totalDistance;
}

export function calculateTotalFuelCost(fuelEntries: FuelEntry[]) {
  return fuelEntries.reduce((sum, entry) => sum + entry.price, 0);
}

export function calculateTotalMaintenanceCost(entries: MaintenanceEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.cost, 0);
}

export function formatCurrency(value: number) {
  return `EUR ${value.toFixed(2)}`;
}

export function formatCostPerKm(value: number) {
  return `EUR ${value.toFixed(2)}/km`;
}
