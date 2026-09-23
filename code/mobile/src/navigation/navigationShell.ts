import type { AppTabParamList, GarageStackParamList, RootStackParamList } from './types';

export const primaryTabsUseNavigationHeaders = false;

export const primaryTabShell: Record<keyof AppTabParamList, {
    label: string;
    accessibilityLabel: string;
    iconName: string;
}> = {
    Home: { label: 'Home', accessibilityLabel: 'Home', iconName: 'home-outline' },
    History: { label: 'History', accessibilityLabel: 'History', iconName: 'time-outline' },
    Add: { label: 'Add', accessibilityLabel: 'Add a vehicle event', iconName: 'add-circle-outline' },
    Garage: { label: 'Garage', accessibilityLabel: 'Garage', iconName: 'car-outline' },
    Settings: { label: 'Settings', accessibilityLabel: 'Settings', iconName: 'settings-outline' },
};

export const garageStackHeaders: Record<keyof GarageStackParamList, string | null> = {
    GarageHome: null,
    AddVehicle: 'Add vehicle',
    EditVehicle: 'Edit vehicle',
};

export const detailScreenHeaders: Record<Exclude<keyof RootStackParamList, 'PrimaryTabs'>, string> = {
    FuelEntry: 'Fill-up',
    ChargingEntry: 'Charge',
    MaintenanceEntry: 'Maintenance',
    OwnershipExpenseEntry: 'Add ownership expense',
    OwnershipExpenses: 'Ownership expenses',
    UpdateOdometer: 'Update odometer',
    CreateAccount: 'Create account',
    SignIn: 'Sign in',
};
