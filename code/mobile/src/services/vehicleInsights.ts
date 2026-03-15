import { FuelEntry } from "../models/FuelEntry";
import { MaintenanceEntry } from "../models/MaintenanceEntry";
import { Vehicle } from "../models/Vehicle";
import {
  getEnergyCostLabel,
  getEnergyUnitLabel,
  isElectricVehicle,
} from "./vehicleProfile";

export interface VehicleInsight {
  title: string;
  value: string;
  detail: string;
}

function formatDecimal(value: number) {
  return value.toFixed(1);
}

export function buildVehicleInsights(
  vehicle: Vehicle,
  fuelEntries: FuelEntry[],
  maintenanceEntries: MaintenanceEntry[],
  trackedDistance: number,
  totalFuelCost: number,
  totalMaintenanceCost: number,
): VehicleInsight[] {
  const insights: VehicleInsight[] = [];

  if (fuelEntries.length > 0) {
    const averageEnergyCost = totalFuelCost / fuelEntries.length;
    insights.push({
      title: `Average ${getEnergyCostLabel(vehicle).toLowerCase()}`,
      value: `EUR ${averageEnergyCost.toFixed(2)}`,
      detail: `Across ${fuelEntries.length} recorded ${
        isElectricVehicle(vehicle) ? "sessions" : "stops"
      }.`,
    });

    const totalEnergy = fuelEntries.reduce((sum, entry) => sum + entry.liters, 0);
    insights.push({
      title: isElectricVehicle(vehicle)
        ? "Average charge size"
        : "Average fill-up size",
      value: `${formatDecimal(totalEnergy / fuelEntries.length)} ${getEnergyUnitLabel(
        vehicle,
      )}`,
      detail: "Useful for spotting charging or fill-up habits over time.",
    });

    if (trackedDistance > 0) {
      const consumptionPer100 = (totalEnergy / trackedDistance) * 100;
      insights.push({
        title: isElectricVehicle(vehicle)
          ? "Estimated energy use"
          : "Estimated fuel use",
        value: `${formatDecimal(consumptionPer100)} ${getEnergyUnitLabel(
          vehicle,
        )}/100 km`,
        detail:
          "Estimated from your tracked distance, so it gets better as you log more entries.",
      });
    }
  }

  const totalCost = totalFuelCost + totalMaintenanceCost;
  if (totalCost > 0 && totalMaintenanceCost > 0) {
    const maintenanceShare = (totalMaintenanceCost / totalCost) * 100;
    insights.push({
      title: "Maintenance share",
      value: `${maintenanceShare.toFixed(0)}%`,
      detail: "Share of your tracked ownership cost coming from maintenance.",
    });
  }

  return insights.slice(0, 3);
}

