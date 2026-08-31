import { Vehicle } from '../models/Vehicle';

const FIRST_AUTOMOBILE_YEAR = 1886;
const YEAR_AFTER_CURRENT_YEAR = 1;
const MINIMUM_ENERGY_QUANTITY = 0.000001;

type ValidationSuccess<T> = { ok: true; value: T };
type ValidationFailure = { ok: false; error: string };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface VehicleFormInput {
    brand: string;
    model: string;
    year: string;
    label: string;
    fuelType: string;
    engine: string;
    powerHp: string;
    transmission: string;
    ownershipStartMileage: string;
    trackingStartMileage: string;
    currentOdometer: string;
}

function requiredText(value: string, label: string): ValidationResult<string> {
    const normalized = value.trim();
    return normalized ? { ok: true, value: normalized } : { ok: false, error: `${label} is required.` };
}

function decimal(value: string, label: string, minimum: number): ValidationResult<number> {
    const parsed = Number(value);

    if (!value.trim() || !Number.isFinite(parsed) || parsed < minimum) {
        return { ok: false, error: `${label} must be ${minimum === 0 ? 'zero or greater' : 'greater than zero'}.` };
    }

    return { ok: true, value: parsed };
}

function wholeNumber(value: string, label: string, minimum: number): ValidationResult<number> {
    const result = decimal(value, label, minimum);

    if (!result.ok || !Number.isInteger(result.value)) {
        return { ok: false, error: `${label} must be a whole number.` };
    }

    return result;
}

export function validateVehicleForm(input: VehicleFormInput): ValidationResult<Omit<Vehicle, 'id' | 'clientId'>> {
    const brand = requiredText(input.brand, 'Brand');
    if (!brand.ok) return brand;

    const model = requiredText(input.model, 'Model');
    if (!model.ok) return model;

    const year = wholeNumber(input.year, 'Year', FIRST_AUTOMOBILE_YEAR);
    const maximumYear = new Date().getFullYear() + YEAR_AFTER_CURRENT_YEAR;
    if (!year.ok || year.value > maximumYear) {
        return { ok: false, error: `Year must be between ${FIRST_AUTOMOBILE_YEAR} and ${maximumYear}.` };
    }

    const ownershipStartMileage = wholeNumber(input.ownershipStartMileage, 'Ownership start mileage', 0);
    if (!ownershipStartMileage.ok) return ownershipStartMileage;

    const trackingStartMileage = wholeNumber(input.trackingStartMileage, 'Tracking start mileage', 0);
    if (!trackingStartMileage.ok) return trackingStartMileage;

    const currentOdometer = wholeNumber(input.currentOdometer, 'Current odometer', 0);
    if (!currentOdometer.ok) return currentOdometer;

    if (trackingStartMileage.value < ownershipStartMileage.value) {
        return { ok: false, error: 'Tracking start mileage cannot be before ownership start mileage.' };
    }

    if (currentOdometer.value < trackingStartMileage.value) {
        return { ok: false, error: 'Current odometer cannot be before tracking start mileage.' };
    }

    const powerHp = input.powerHp.trim() ? wholeNumber(input.powerHp, 'Power', 1) : undefined;
    if (powerHp && !powerHp.ok) return powerHp;

    return {
        ok: true,
        value: {
            brand: brand.value,
            model: model.value,
            year: year.value,
            label: optionalText(input.label),
            fuelType: optionalText(input.fuelType),
            engine: optionalText(input.engine),
            powerHp: powerHp?.value,
            transmission: optionalText(input.transmission),
            ownershipStartMileage: ownershipStartMileage.value,
            trackingStartMileage: trackingStartMileage.value,
            currentOdometer: currentOdometer.value,
        },
    };
}

export function validateEnergyEntryForm(input: {
    quantity: string;
    price: string;
    odometer: string;
}): ValidationResult<{ quantity: number; price: number; odometer: number }> {
    const quantity = decimal(input.quantity, 'Energy quantity', MINIMUM_ENERGY_QUANTITY);
    if (!quantity.ok) return quantity;

    const price = decimal(input.price, 'Price', 0);
    if (!price.ok) return price;

    const odometer = wholeNumber(input.odometer, 'Odometer', 0);
    if (!odometer.ok) return odometer;

    return { ok: true, value: { quantity: quantity.value, price: price.value, odometer: odometer.value } };
}

export function validateMaintenanceEntryForm(input: {
    type: string;
    cost: string;
    odometer: string;
}): ValidationResult<{ type: string; cost: number; odometer: number }> {
    const type = requiredText(input.type, 'Maintenance type');
    if (!type.ok) return type;

    const cost = decimal(input.cost, 'Cost', 0);
    if (!cost.ok) return cost;

    const odometer = wholeNumber(input.odometer, 'Odometer', 0);
    if (!odometer.ok) return odometer;

    return { ok: true, value: { type: type.value, cost: cost.value, odometer: odometer.value } };
}

function optionalText(value: string): string | undefined {
    const normalized = value.trim();
    return normalized || undefined;
}
