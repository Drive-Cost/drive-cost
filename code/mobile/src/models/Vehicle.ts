export interface Vehicle {
    id?: number;
    clientId?: string;
    brand: string;
    model: string;
    year: number;
    label?: string;
    fuelType?: string;
    engine?: string;
    powerHp?: number;
    transmission?: string;
    ownershipStartMileage: number;
    trackingStartMileage: number;
    currentOdometer: number;
    currentMileage?: number;
}
