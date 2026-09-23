import { describe, expect, it } from 'vitest';
import { AddAction, getAddActionOptions, getAddEmptyStateCopy, getVehicleCreationDestination, primaryDestinations } from '../../src/navigation/primaryNavigation';
import { getActiveVehicle } from '../../src/services/vehicle/activeVehicle';
import { detailScreenHeaders, garageStackHeaders, primaryTabShell, primaryTabsUseNavigationHeaders } from '../../src/navigation/navigationShell';

const iceVehicle = {
    id: 1,
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    fuelType: 'Petrol',
    ownershipStartMileage: 8_000,
    trackingStartMileage: 9_000,
    currentOdometer: 10_000,
};

const evVehicle = { ...iceVehicle, id: 2, fuelType: 'EV' };

describe('primary navigation', () => {
    it('has the five consumer-facing destinations and no permanent energy or maintenance tabs', () => {
        expect(primaryDestinations).toEqual(['Home', 'History', 'Add', 'Garage', 'Settings']);
        expect(primaryDestinations).not.toContain('Fuel');
        expect(primaryDestinations).not.toContain('Charging');
        expect(primaryDestinations).not.toContain('Maintenance');
    });

    it('uses one page-owned heading for primary tabs while retaining native headers on detail routes', () => {
        expect(primaryTabsUseNavigationHeaders).toBe(false);
        expect(Object.values(primaryTabShell).map((tab) => tab.label)).toEqual(['Home', 'History', 'Add', 'Garage', 'Settings']);
        expect(Object.values(primaryTabShell).map((tab) => tab.iconName)).toEqual([
            'home-outline', 'time-outline', 'add-circle-outline', 'car-outline', 'settings-outline',
        ]);
        expect(garageStackHeaders).toEqual({ GarageHome: null, AddVehicle: 'Add vehicle', EditVehicle: 'Edit vehicle' });
        expect(detailScreenHeaders).toMatchObject({ FuelEntry: 'Fill-up', ChargingEntry: 'Charge', MaintenanceEntry: 'Maintenance' });
    });

    it('offers only relevant energy capture for ICE and EV vehicles while retaining shared actions', () => {
        expect(getAddActionOptions(iceVehicle).map((action) => action.id)).toEqual([
            AddAction.Fuel,
            AddAction.Maintenance,
            AddAction.OwnershipExpense,
            AddAction.Odometer,
        ]);
        expect(getAddActionOptions(evVehicle).map((action) => action.id)).toEqual([
            AddAction.Charging,
            AddAction.Maintenance,
            AddAction.OwnershipExpense,
            AddAction.Odometer,
        ]);
        expect(getAddActionOptions(iceVehicle).map((action) => action.route)).toEqual([
            'FuelEntry',
            'MaintenanceEntry',
            'OwnershipExpenseEntry',
            'UpdateOdometer',
        ]);
        expect(getAddActionOptions(evVehicle)[0].route).toBe('ChargingEntry');
    });

    it('keeps current conservative PHEV behavior and takes people without a vehicle directly to creation', () => {
        expect(getAddActionOptions({ ...iceVehicle, fuelType: 'PHEV' }).map((action) => action.id)).toContain(AddAction.Fuel);
        expect(getAddActionOptions({ ...iceVehicle, fuelType: 'PHEV' }).map((action) => action.id)).not.toContain(AddAction.Charging);
        expect(getAddActionOptions()).toEqual([]);
        expect(getAddEmptyStateCopy()).toMatchObject({ title: 'Choose a vehicle first', actionLabel: 'Add a vehicle' });
        expect(getVehicleCreationDestination()).toEqual({ tab: 'Garage', screen: 'AddVehicle' });
    });

    it('resolves Home, History, and Add against the current active vehicle without retaining the previous vehicle', () => {
        const vehicles = [iceVehicle, evVehicle];

        expect(getActiveVehicle(vehicles, 1)).toBe(iceVehicle);
        expect(getActiveVehicle(vehicles, 2)).toBe(evVehicle);
        expect(getActiveVehicle(vehicles, null)).toBeUndefined();
    });
});
