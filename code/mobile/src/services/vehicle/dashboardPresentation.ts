import { Vehicle } from '../../models/Vehicle';
import { isElectricVehicle } from './vehicleProfile';

export interface DashboardMetricCopy {
    sectionTitle: 'Tracked costs';
    scopeLabel: 'Since tracking';
    categorySummary: string;
    energyCostLabel: string;
    maintenanceCostLabel: 'Tracked maintenance cost';
    ownershipExpenseCostLabel: 'Tracked ownership expenses';
    costPerKmLabel: 'Tracked cost / km';
    drivenDistanceLabel: 'Driven since tracking';
}

function energyCategory(vehicle: Vehicle): 'fuel' | 'charging' {
    return isElectricVehicle(vehicle) ? 'charging' : 'fuel';
}

export function getDashboardMetricCopy(vehicle: Vehicle): DashboardMetricCopy {
    const energy = energyCategory(vehicle);

    return {
        sectionTitle: 'Tracked costs',
        scopeLabel: 'Since tracking',
        categorySummary: `Recorded ${energy}, maintenance, and ownership expenses. Depreciation is not included.`,
        energyCostLabel: `Tracked ${energy} cost`,
        maintenanceCostLabel: 'Tracked maintenance cost',
        ownershipExpenseCostLabel: 'Tracked ownership expenses',
        costPerKmLabel: 'Tracked cost / km',
        drivenDistanceLabel: 'Driven since tracking',
    };
}

export function getMaintenanceShareDetail(vehicle: Vehicle, totalEnergyCost: number, totalOwnershipExpenseCost = 0): string {
    if (totalEnergyCost > 0 || totalOwnershipExpenseCost > 0) {
        return `Share of tracked ${energyCategory(vehicle)}, maintenance, and ownership expenses coming from maintenance.`;
    }

    return 'All currently tracked costs are maintenance.';
}
