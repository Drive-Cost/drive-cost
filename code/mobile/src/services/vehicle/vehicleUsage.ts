import { ChargingEntry } from '../../models/ChargingEntry';
import { FuelEntry } from '../../models/FuelEntry';
import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { Vehicle } from '../../models/Vehicle';
import { getEnergyEntries } from './energyEntries';

export interface MileageSnapshot {
    ownershipStartMileage: number;
    trackingStartMileage: number;
    ownershipDistance: number;
    latestRecordedMileage: number;
    trackedDistance: number;
    hasRecordedMileage: boolean;
}

export function createMileageSnapshot(
    vehicle: Vehicle,
    fuelEntries: FuelEntry[],
    maintenanceEntries: MaintenanceEntry[],
    chargingEntries: ChargingEntry[] = [],
): MileageSnapshot {
    const trackingStartMileage = vehicle.trackingStartMileage;
    const ownershipStartMileage = vehicle.ownershipStartMileage;
    const recordedMileage = [...getEnergyEntries(vehicle, fuelEntries, chargingEntries), ...maintenanceEntries]
        .map((entry) => entry.odometer)
        .filter((value) => Number.isFinite(value));
    const latestKnownOdometer = vehicle.currentOdometer;

    const latestRecordedMileage = recordedMileage.length
        ? Math.max(latestKnownOdometer, ...recordedMileage)
        : latestKnownOdometer;

    return {
        ownershipStartMileage,
        trackingStartMileage,
        ownershipDistance: Math.max(0, latestRecordedMileage - ownershipStartMileage),
        latestRecordedMileage,
        trackedDistance: Math.max(0, latestRecordedMileage - trackingStartMileage),
        hasRecordedMileage: recordedMileage.length > 0,
    };
}
