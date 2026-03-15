import { Vehicle } from "../models/Vehicle";

function normalizeFuelType(fuelType?: string) {
  return fuelType?.trim().toLowerCase() ?? "";
}

export function isElectricVehicle(vehicle?: Vehicle) {
  const fuelType = normalizeFuelType(vehicle?.fuelType);
  return fuelType === "ev" || fuelType === "electric";
}

export function getEnergyEntryLabel(vehicle?: Vehicle) {
  return isElectricVehicle(vehicle) ? "Charge" : "Fuel";
}

export function getEnergyCostLabel(vehicle?: Vehicle) {
  return isElectricVehicle(vehicle) ? "Energy cost" : "Fuel cost";
}

export function getEnergyUnitLabel(vehicle?: Vehicle) {
  return isElectricVehicle(vehicle) ? "kWh" : "L";
}

export function getEnergyIntroCopy(vehicle?: Vehicle) {
  return isElectricVehicle(vehicle)
    ? "Record each charge session locally and use odometer values to understand your energy cost."
    : "Record each fill-up locally and use odometer values to estimate your running cost.";
}

export function getEnergyHistoryTitle(vehicle?: Vehicle) {
  return isElectricVehicle(vehicle)
    ? "Recent charge sessions"
    : "Recent fuel entries";
}

export function getEnergyHistoryEmptyState(vehicle?: Vehicle) {
  return isElectricVehicle(vehicle)
    ? "No charge sessions yet. Your last saves will show up here."
    : "No fuel entries yet. Your last saves will show up here.";
}

export function getEnergyEventTitle(vehicle?: Vehicle) {
  return isElectricVehicle(vehicle) ? "Charge session" : "Fuel fill-up";
}
