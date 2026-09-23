import { Vehicle } from '../models/Vehicle';
import { FuelFillStatus } from '../models/FuelEntry';
import { ExpenseCategory } from '../models/ExpenseEntry';
import { RecurringExpensePeriodMonths, isSupportedRecurringPeriod } from '../models/RecurringExpense';
import { parseCalendarDate, toCalendarDate, todayCalendarDate } from './entryDate';
import { fuelTypeForVehicleType, isSupportedVehicleType } from './vehicleType';

const FIRST_AUTOMOBILE_YEAR = 1886;
const YEAR_AFTER_CURRENT_YEAR = 1;
const MINIMUM_ENERGY_QUANTITY = 0.000001;
const INVALID_ENTRY_DATE_MESSAGE = 'Date must use YYYY-MM-DD.';

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
    trackingStartDate: string;
    currentOdometer: string;
}

export interface VehicleCreateFormInput {
    brand: string;
    model: string;
    year: string;
    vehicleType: string;
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

    const trackingStartDate = input.trackingStartDate.trim()
        ? validTrackingStartDate(input.trackingStartDate)
        : { ok: true as const, value: null };
    if (!trackingStartDate.ok) return trackingStartDate;

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
            trackingStartDate: trackingStartDate.value,
            currentOdometer: currentOdometer.value,
        },
    };
}

export function validateVehicleCreateForm(
    input: VehicleCreateFormInput,
    now = new Date(),
): ValidationResult<Omit<Vehicle, 'id' | 'clientId'>> {
    const brand = requiredText(input.brand, 'Brand');
    if (!brand.ok) return brand;

    const model = requiredText(input.model, 'Model');
    if (!model.ok) return model;

    const year = wholeNumber(input.year, 'Year', FIRST_AUTOMOBILE_YEAR);
    const maximumYear = new Date().getFullYear() + YEAR_AFTER_CURRENT_YEAR;
    if (!year.ok || year.value > maximumYear) {
        return { ok: false, error: `Year must be between ${FIRST_AUTOMOBILE_YEAR} and ${maximumYear}.` };
    }

    if (!isSupportedVehicleType(input.vehicleType)) {
        return { ok: false, error: 'Choose a vehicle type.' };
    }

    const currentOdometer = wholeNumber(input.currentOdometer, 'Current odometer', 0);
    if (!currentOdometer.ok) return currentOdometer;

    return {
        ok: true,
        value: {
            brand: brand.value,
            model: model.value,
            year: year.value,
            fuelType: fuelTypeForVehicleType(input.vehicleType),
            ownershipStartMileage: currentOdometer.value,
            trackingStartMileage: currentOdometer.value,
            trackingStartDate: todayCalendarDate(now),
            currentOdometer: currentOdometer.value,
        },
    };
}

function validTrackingStartDate(value: string): ValidationResult<string> {
    const date = parseCalendarDate(value);
    return date ? { ok: true, value: toCalendarDate(date) } : { ok: false, error: INVALID_ENTRY_DATE_MESSAGE };
}

export function validateEnergyEntryForm(input: {
    quantity: string;
    price: string;
    odometer: string;
    date: string;
}): ValidationResult<{ quantity: number; price: number; odometer: number; date: string }> {
    const quantity = decimal(input.quantity, 'Energy quantity', MINIMUM_ENERGY_QUANTITY);
    if (!quantity.ok) return quantity;

    const price = decimal(input.price, 'Total paid', 0);
    if (!price.ok) return price;

    const odometer = wholeNumber(input.odometer, 'Odometer', 0);
    if (!odometer.ok) return odometer;

    const date = validEntryDate(input.date);
    if (!date.ok) return date;

    return { ok: true, value: { quantity: quantity.value, price: price.value, odometer: odometer.value, date: date.value } };
}

export function validateFuelEntryForm(
    input: {
        quantity: string;
        price: string;
        odometer: string;
        date: string;
        fillStatus: string;
    },
    allowUnknownFillStatus: boolean,
): ValidationResult<{
    quantity: number;
    price: number;
    odometer: number;
    date: string;
    fillStatus: FuelFillStatus;
}> {
    const energy = validateEnergyEntryForm(input);
    if (!energy.ok) return energy;

    if (
        input.fillStatus !== FuelFillStatus.Full
        && input.fillStatus !== FuelFillStatus.Partial
        && input.fillStatus !== FuelFillStatus.Unknown
    ) {
        return { ok: false, error: 'Choose Full tank or Partial fill.' };
    }

    if (!allowUnknownFillStatus && input.fillStatus === FuelFillStatus.Unknown) {
        return { ok: false, error: 'Choose Full tank or Partial fill.' };
    }

    return { ok: true, value: { ...energy.value, fillStatus: input.fillStatus } };
}

export function validateMaintenanceEntryForm(input: {
    type: string;
    cost: string;
    odometer: string;
    date: string;
}): ValidationResult<{ type: string; cost: number; odometer: number; date: string }> {
    const type = requiredText(input.type, 'Maintenance type');
    if (!type.ok) return type;

    const cost = decimal(input.cost, 'Cost', 0);
    if (!cost.ok) return cost;

    const odometer = wholeNumber(input.odometer, 'Odometer', 0);
    if (!odometer.ok) return odometer;

    const date = validEntryDate(input.date);
    if (!date.ok) return date;

    return { ok: true, value: { type: type.value, cost: cost.value, odometer: odometer.value, date: date.value } };
}

export function validateNewEntryOdometer(odometer: number, currentOdometer: number): ValidationResult<number> {
    if (odometer < currentOdometer) {
        return { ok: false, error: 'Odometer cannot be lower than the current odometer.' };
    }
    return { ok: true, value: odometer };
}

export function validateExpenseEntryForm(input: {
    category: string;
    totalPaid: string;
    date: string;
    odometer: string;
    description: string;
}): ValidationResult<{
    category: ExpenseCategory;
    totalPaid: number;
    date: string;
    odometer?: number;
    description?: string;
}> {
    if (!Object.values(ExpenseCategory).includes(input.category as ExpenseCategory)) {
        return { ok: false, error: 'Choose an expense category.' };
    }

    const totalPaid = decimal(input.totalPaid, 'Total paid', MINIMUM_ENERGY_QUANTITY);
    if (!totalPaid.ok) return totalPaid;

    const date = validEntryDate(input.date);
    if (!date.ok) return date;

    const odometer = input.odometer.trim() ? wholeNumber(input.odometer, 'Odometer', 0) : undefined;
    if (odometer && !odometer.ok) return odometer;

    return {
        ok: true,
        value: {
            category: input.category as ExpenseCategory,
            totalPaid: totalPaid.value,
            date: date.value,
            odometer: odometer?.value,
            description: optionalText(input.description),
        },
    };
}

export function validateRecurringExpenseForm(input: {
    category: string;
    amount: string;
    periodMonths: string;
    startDate: string;
    nextDueDate: string;
    description: string;
}): ValidationResult<{
    category: ExpenseCategory;
    amount: number;
    periodMonths: RecurringExpensePeriodMonths;
    startDate: string;
    nextDueDate?: string;
    description?: string;
}> {
    if (!Object.values(ExpenseCategory).includes(input.category as ExpenseCategory)) {
        return { ok: false, error: 'Choose an expense category.' };
    }
    const amount = decimal(input.amount, 'Amount', MINIMUM_ENERGY_QUANTITY);
    if (!amount.ok) return amount;
    const periodMonths = Number(input.periodMonths);
    if (!isSupportedRecurringPeriod(periodMonths)) return { ok: false, error: 'Choose a recurrence.' };
    const startDate = validEntryDate(input.startDate);
    if (!startDate.ok) return startDate;
    const nextDueDate = input.nextDueDate.trim() ? validEntryDate(input.nextDueDate) : undefined;
    if (nextDueDate && !nextDueDate.ok) return nextDueDate;
    return {
        ok: true,
        value: {
            category: input.category as ExpenseCategory,
            amount: amount.value,
            periodMonths,
            startDate: startDate.value,
            nextDueDate: nextDueDate?.value,
            description: optionalText(input.description),
        },
    };
}

function validEntryDate(value: string): ValidationResult<string> {
    const date = parseCalendarDate(value);
    return date ? { ok: true, value: date } : { ok: false, error: INVALID_ENTRY_DATE_MESSAGE };
}

function optionalText(value: string): string | undefined {
    const normalized = value.trim();
    return normalized || undefined;
}
