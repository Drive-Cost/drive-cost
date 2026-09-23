import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { Vehicle } from '../../models/Vehicle';
import { EnergyEntry } from './energyEntries';
import { FuelConsumptionCalculation } from './fuelConsumption';
import { getMaintenanceShareDetail } from './dashboardPresentation';
import { getEnergyCostLabel, getEnergyUnitLabel, isElectricVehicle } from './vehicleProfile';

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
    energyEntries: EnergyEntry[],
    maintenanceEntries: MaintenanceEntry[],
    totalEnergyCost: number,
    totalMaintenanceCost: number,
    fuelConsumption: FuelConsumptionCalculation | null,
    totalOwnershipExpenseCost = 0,
): VehicleInsight[] {
    const insights: VehicleInsight[] = [];

    if (energyEntries.length > 0) {
        const averageEnergyCost = totalEnergyCost / energyEntries.length;
        insights.push({
            title: `Average ${getEnergyCostLabel(vehicle).toLowerCase()}`,
            value: `EUR ${averageEnergyCost.toFixed(2)}`,
            detail: `Across ${energyEntries.length} recorded ${isElectricVehicle(vehicle) ? 'sessions' : 'stops'}.`,
        });

        const totalEnergy = energyEntries.reduce((sum, entry) => sum + entry.quantity, 0);
        insights.push({
            title: isElectricVehicle(vehicle) ? 'Average charge size' : 'Average fill-up size',
            value: `${formatDecimal(totalEnergy / energyEntries.length)} ${getEnergyUnitLabel(vehicle)}`,
            detail: 'Useful for spotting charging or fill-up habits over time.',
        });

    }

    if (!isElectricVehicle(vehicle) && fuelConsumption?.latestInterval) {
        const interval = fuelConsumption.latestInterval;
        insights.push({
            title: 'Latest fuel consumption',
            value: `${formatDecimal(interval.litersPer100Km)} L/100 km`,
            detail: `Measured across ${interval.distanceKm.toLocaleString()} km between full tanks.`,
        });
    }

    const totalCost = totalEnergyCost + totalMaintenanceCost + totalOwnershipExpenseCost;
    if (totalCost > 0 && totalMaintenanceCost > 0) {
        const maintenanceShare = (totalMaintenanceCost / totalCost) * 100;
        insights.push({
            title: 'Maintenance share',
            value: `${maintenanceShare.toFixed(0)}%`,
            detail: getMaintenanceShareDetail(vehicle, totalEnergyCost, totalOwnershipExpenseCost),
        });
    }

    return insights.slice(0, 4);
}
