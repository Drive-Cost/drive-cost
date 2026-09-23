import { Vehicle } from '../models/Vehicle';
import { isElectricVehicle } from '../services/vehicle/vehicleProfile';
import { AppTabParamList, RootStackParamList } from './types';

export const primaryDestinations = ['Home', 'History', 'Add', 'Garage', 'Settings'] as const satisfies readonly (keyof AppTabParamList)[];

export const AddAction = {
    Fuel: 'fuel',
    Charging: 'charging',
    Maintenance: 'maintenance',
    OwnershipExpense: 'ownership-expense',
    Odometer: 'odometer',
} as const;

export type AddAction = (typeof AddAction)[keyof typeof AddAction];

export interface AddActionOption {
    id: AddAction;
    title: string;
    detail: string;
    route: Exclude<keyof RootStackParamList, 'PrimaryTabs'>;
}

const commonActions: readonly AddActionOption[] = [
    { id: AddAction.Maintenance, title: 'Add maintenance', detail: 'Record service, repairs, or parts.', route: 'MaintenanceEntry' },
    { id: AddAction.OwnershipExpense, title: 'Add ownership expense', detail: 'Record insurance, tax, parking, and other ownership payments.', route: 'OwnershipExpenseEntry' },
    { id: AddAction.Odometer, title: 'Update odometer', detail: 'Keep the vehicle’s current odometer up to date.', route: 'UpdateOdometer' },
];

const fuelAction: AddActionOption = {
    id: AddAction.Fuel,
    title: 'Add fill-up',
    detail: 'Record a fuel fill-up.',
    route: 'FuelEntry',
};

const chargingAction: AddActionOption = {
    id: AddAction.Charging,
    title: 'Add charge',
    detail: 'Record a charging session.',
    route: 'ChargingEntry',
};

export function getAddActionOptions(vehicle?: Vehicle): readonly AddActionOption[] {
    if (!vehicle) return [];

    // PHEV is not yet a supported energy-mode model. It keeps the existing
    // fuel-only capture path until a later task defines dual-energy semantics.
    return [isElectricVehicle(vehicle) ? chargingAction : fuelAction, ...commonActions];
}

export function getAddEmptyStateCopy() {
    return {
        title: 'Choose a vehicle first',
        detail: 'Add or select a vehicle in Garage before recording costs or updating its odometer.',
        actionLabel: 'Add a vehicle',
    };
}

export function getVehicleCreationDestination() {
    return { tab: 'Garage' as const, screen: 'AddVehicle' as const };
}
