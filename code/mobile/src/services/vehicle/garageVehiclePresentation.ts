import { vehicleTypeForFuelType, vehicleTypeLabelForFuelType } from '../../domain/vehicleType';
import type { Vehicle } from '../../models/Vehicle';

export interface GarageVehiclePresentation {
    name: string;
    context?: string;
    odometer: string;
    isActive: boolean;
    showsSetActive: boolean;
}

export function getGarageVehiclePresentation(
    vehicle: Vehicle,
    activeVehicleId: number | null,
): GarageVehiclePresentation {
    const year = Number.isInteger(vehicle.year) && vehicle.year > 0 ? String(vehicle.year) : undefined;
    const type = garageVehicleTypeLabel(vehicle.fuelType);

    return {
        name: vehicleIdentity(vehicle),
        context: [year, type].filter((value): value is string => Boolean(value)).join(' · ') || undefined,
        odometer: `${vehicle.currentOdometer.toLocaleString('en-GB')} km`,
        isActive: vehicle.id === activeVehicleId,
        showsSetActive: vehicle.id !== activeVehicleId,
    };
}

function garageVehicleTypeLabel(fuelType?: string): string | undefined {
    // Garage is a consumer-facing summary. Do not leak an unrecognised legacy
    // persistence value such as "undefined" or punctuation into this line.
    return vehicleTypeForFuelType(fuelType)
        ? vehicleTypeLabelForFuelType(fuelType)
        : undefined;
}

function vehicleIdentity(vehicle: Vehicle): string {
    const brand = vehicle.brand.trim();
    const model = vehicle.model.trim();
    const canonicalName = !model || brand.toLocaleLowerCase() === model.toLocaleLowerCase()
        ? brand || model || 'Vehicle'
        : `${brand} ${model}`.trim();
    const label = vehicle.label?.trim();

    if (!label) return canonicalName;
    const normalizedLabel = label.toLocaleLowerCase();
    if (
        normalizedLabel === canonicalName.toLocaleLowerCase()
        || normalizedLabel === brand.toLocaleLowerCase()
        || normalizedLabel === model.toLocaleLowerCase()
    ) {
        return canonicalName;
    }
    return label;
}
