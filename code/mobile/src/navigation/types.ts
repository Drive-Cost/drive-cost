import type { NavigatorScreenParams } from '@react-navigation/native';

export type GarageStackParamList = {
    GarageHome: undefined;
    AddVehicle: undefined;
    EditVehicle: { vehicleId: number };
};

export type AppTabParamList = {
    Dashboard: undefined;
    Garage: NavigatorScreenParams<GarageStackParamList> | undefined;
    Fuel: undefined;
    Maintenance: undefined;
};
