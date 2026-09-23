export const vehicleTypeOptions = [
    { id: 'petrol', label: 'Petrol', fuelType: 'Petrol' },
    { id: 'diesel', label: 'Diesel', fuelType: 'Diesel' },
    { id: 'electric', label: 'Electric', fuelType: 'EV' },
    { id: 'hybrid', label: 'Hybrid', fuelType: 'Hybrid' },
    { id: 'phev', label: 'Plug-in hybrid', fuelType: 'PHEV' },
] as const;

export type VehicleTypeId = (typeof vehicleTypeOptions)[number]['id'];

export function isSupportedVehicleType(value: string): value is VehicleTypeId {
    return vehicleTypeOptions.some((option) => option.id === value);
}

export function fuelTypeForVehicleType(vehicleType: VehicleTypeId): string {
    return vehicleTypeOptions.find((option) => option.id === vehicleType)?.fuelType ?? '';
}

export function vehicleTypeForFuelType(fuelType?: string): VehicleTypeId | undefined {
    switch (fuelType?.trim().toLowerCase()) {
        case 'petrol':
            return 'petrol';
        case 'diesel':
            return 'diesel';
        case 'ev':
        case 'electric':
            return 'electric';
        case 'hybrid':
            return 'hybrid';
        case 'phev':
        case 'plug-in hybrid':
            return 'phev';
        default:
            return undefined;
    }
}

export function vehicleTypeLabelForFuelType(fuelType?: string): string | undefined {
    const vehicleType = vehicleTypeForFuelType(fuelType);
    if (vehicleType) return vehicleTypeOptions.find((option) => option.id === vehicleType)?.label;

    const fallback = fuelType?.trim();
    return fallback || undefined;
}
