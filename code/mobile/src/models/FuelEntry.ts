import { FuelFillStatus as SharedFuelFillStatus } from '@drivecost/contracts';

export const FuelFillStatus = SharedFuelFillStatus;
export type FuelFillStatus = (typeof FuelFillStatus)[keyof typeof FuelFillStatus];

export interface FuelEntry {
    id?: number;
    clientId?: string;
    vehicleId: number;
    date: string;
    liters: number;
    price: number;
    odometer: number;
    fillStatus: FuelFillStatus;
}

export function normalizeFuelFillStatus(value: unknown): FuelFillStatus {
    if (value === FuelFillStatus.Full || value === FuelFillStatus.Partial || value === FuelFillStatus.Unknown) {
        return value;
    }
    return FuelFillStatus.Unknown;
}

export function normalizeFuelEntry(
    entry: Omit<FuelEntry, 'fillStatus'> & { fillStatus?: unknown },
): FuelEntry {
    return { ...entry, fillStatus: normalizeFuelFillStatus(entry.fillStatus) };
}
