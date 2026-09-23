import type { NavigatorScreenParams } from '@react-navigation/native';

export type GarageStackParamList = {
    GarageHome: undefined;
    AddVehicle: undefined;
    EditVehicle: { vehicleId: number };
};

export type AppTabParamList = {
    Home: undefined;
    History: undefined;
    Add: undefined;
    Garage: NavigatorScreenParams<GarageStackParamList> | undefined;
    Settings: undefined;
};

export type RootStackParamList = {
    PrimaryTabs: NavigatorScreenParams<AppTabParamList> | undefined;
    FuelEntry: undefined;
    ChargingEntry: undefined;
    MaintenanceEntry: undefined;
    OwnershipExpenseEntry: undefined;
    OwnershipExpenses: undefined;
    UpdateOdometer: undefined;
    CreateAccount: undefined;
    SignIn: undefined;
};
