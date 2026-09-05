export interface ChargingEntry {
    id?: number;
    clientId?: string;
    vehicleId: number;
    date: string;
    kWh: number;
    price: number;
    odometer: number;
}
