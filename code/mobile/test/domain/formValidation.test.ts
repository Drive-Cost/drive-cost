import { describe, expect, it } from 'vitest';
import {
    validateEnergyEntryForm,
    validateExpenseEntryForm,
    validateFuelEntryForm,
    validateMaintenanceEntryForm,
    validateNewEntryOdometer,
    validateRecurringExpenseForm,
    validateVehicleCreateForm,
    validateVehicleForm,
} from '../../src/domain/formValidation';
import { FuelFillStatus } from '../../src/models/FuelEntry';
import { ExpenseCategory } from '../../src/models/ExpenseEntry';

const validVehicle = {
    brand: 'Toyota',
    model: 'Corolla',
    year: '2022',
    label: 'Daily driver',
    fuelType: 'Petrol',
    engine: '1.8 Hybrid',
    powerHp: '122',
    transmission: 'Automatic',
    ownershipStartMileage: '12000',
    trackingStartMileage: '15000',
    trackingStartDate: '',
    currentOdometer: '18000',
};

describe('vehicle form validation', () => {
    const validVehicleCreate = {
        brand: 'Toyota',
        model: 'Corolla',
        year: '2022',
        vehicleType: 'petrol',
        currentOdometer: '18000',
    };

    it.each([
        ['petrol', 'Petrol'],
        ['diesel', 'Diesel'],
        ['electric', 'EV'],
    ])('creates a valid %s vehicle with the supported stored type', (vehicleType, fuelType) => {
        expect(validateVehicleCreateForm({ ...validVehicleCreate, vehicleType }, new Date(2026, 8, 6))).toEqual({
            ok: true,
            value: {
                brand: 'Toyota',
                model: 'Corolla',
                year: 2022,
                fuelType,
                ownershipStartMileage: 18000,
                trackingStartMileage: 18000,
                trackingStartDate: '2026-09-06',
                currentOdometer: 18000,
            },
        });
    });

    it('requires only onboarding fields and initializes tracking from the current odometer', () => {
        const result = validateVehicleCreateForm(validVehicleCreate, new Date(2026, 8, 6));

        expect(result).toEqual({
            ok: true,
            value: {
                brand: 'Toyota',
                model: 'Corolla',
                year: 2022,
                fuelType: 'Petrol',
                ownershipStartMileage: 18000,
                trackingStartMileage: 18000,
                trackingStartDate: '2026-09-06',
                currentOdometer: 18000,
            },
        });
        expect(result).not.toMatchObject({ value: { label: expect.anything(), engine: expect.anything(), powerHp: expect.anything(), transmission: expect.anything() } });
    });

    it.each([
        [{ ...validVehicleCreate, brand: '' }, 'Brand is required.'],
        [{ ...validVehicleCreate, model: '' }, 'Model is required.'],
        [{ ...validVehicleCreate, vehicleType: '' }, 'Choose a vehicle type.'],
    ])('requires each create field', (input, error) => {
        expect(validateVehicleCreateForm(input)).toEqual({ ok: false, error });
    });

    it('rejects invalid years and odometers during creation', () => {
        expect(validateVehicleCreateForm({ ...validVehicleCreate, year: '1885' })).toMatchObject({ ok: false, error: expect.stringMatching(/Year must be between/) });
        expect(validateVehicleCreateForm({ ...validVehicleCreate, year: 'not-a-year' })).toMatchObject({ ok: false, error: expect.stringMatching(/Year must be between/) });
        expect(validateVehicleCreateForm({ ...validVehicleCreate, currentOdometer: '-1' })).toEqual({ ok: false, error: 'Current odometer must be a whole number.' });
        expect(validateVehicleCreateForm({ ...validVehicleCreate, currentOdometer: '12.5' })).toEqual({ ok: false, error: 'Current odometer must be a whole number.' });
    });

    it('allows profile metadata to remain optional at creation and editable later', () => {
        const result = validateVehicleForm({ ...validVehicle, engine: '', powerHp: '', transmission: '', label: '' });

        expect(result).toMatchObject({
            ok: true,
            value: { label: undefined, engine: undefined, powerHp: undefined, transmission: undefined },
        });
    });

    it('preserves existing tracking anchors when profile details are edited', () => {
        const result = validateVehicleForm({ ...validVehicle, label: 'Family car', trackingStartDate: '2026-09-06' });

        expect(result).toMatchObject({
            ok: true,
            value: {
                label: 'Family car',
                ownershipStartMileage: 12000,
                trackingStartMileage: 15000,
                trackingStartDate: '2026-09-06',
                currentOdometer: 18000,
            },
        });
    });

    it('parses a valid ownership-distance model', () => {
        const result = validateVehicleForm(validVehicle);

        expect(result).toEqual({
            ok: true,
            value: {
                brand: 'Toyota',
                model: 'Corolla',
                year: 2022,
                label: 'Daily driver',
                fuelType: 'Petrol',
                engine: '1.8 Hybrid',
                powerHp: 122,
                transmission: 'Automatic',
                ownershipStartMileage: 12000,
                trackingStartMileage: 15000,
                trackingStartDate: null,
                currentOdometer: 18000,
            },
        });
    });

    it('rejects an impossible tracking baseline', () => {
        const result = validateVehicleForm({ ...validVehicle, trackingStartMileage: '11000' });

        expect(result).toEqual({
            ok: false,
            error: 'Tracking start mileage cannot be before ownership start mileage.',
        });
    });

    it('rejects a current odometer before the tracking baseline', () => {
        const result = validateVehicleForm({ ...validVehicle, currentOdometer: '14000' });

        expect(result).toEqual({ ok: false, error: 'Current odometer cannot be before tracking start mileage.' });
    });

    it('accepts an optional tracking start date and rejects invalid calendar values', () => {
        expect(validateVehicleForm({ ...validVehicle, trackingStartDate: '2026-09-06' })).toMatchObject({
            ok: true,
            value: { trackingStartDate: '2026-09-06' },
        });
        expect(validateVehicleForm({ ...validVehicle, trackingStartDate: '2026-02-30' })).toEqual({
            ok: false,
            error: 'Date must use YYYY-MM-DD.',
        });
    });
});

describe('entry form validation', () => {
    it('allows a zero-cost charging entry', () => {
        expect(validateEnergyEntryForm({ quantity: '42.5', price: '0', odometer: '18010', date: '2026-09-03' })).toEqual({
            ok: true,
            value: { quantity: 42.5, price: 0, odometer: 18010, date: '2026-09-03T00:00:00.000Z' },
        });
    });

    it('requires a new fuel entry to declare a full or partial tank, while keeping legacy unknown entries editable', () => {
        const input = {
            quantity: '42.5',
            price: '70',
            odometer: '18010',
            date: '2026-09-03',
            fillStatus: FuelFillStatus.Unknown,
        };

        expect(validateFuelEntryForm(input, false)).toEqual({
            ok: false,
            error: 'Choose Full tank or Partial fill.',
        });
        expect(validateFuelEntryForm(input, true)).toEqual({
            ok: true,
            value: {
                quantity: 42.5,
                price: 70,
                odometer: 18010,
                date: '2026-09-03T00:00:00.000Z',
                fillStatus: FuelFillStatus.Unknown,
            },
        });
    });

    it.each([FuelFillStatus.Full, FuelFillStatus.Partial])('accepts a new %s fill-up with a visible explicit status', (fillStatus) => {
        expect(validateFuelEntryForm({
            quantity: '42.5',
            price: '70',
            odometer: '18010',
            date: '2026-09-03',
            fillStatus,
        }, false)).toMatchObject({ ok: true, value: { fillStatus } });
    });

    it('rejects invalid energy quantity and payment values while allowing a zero-cost charge', () => {
        expect(validateEnergyEntryForm({ quantity: '0', price: '70', odometer: '18010', date: '2026-09-03' })).toEqual({ ok: false, error: 'Energy quantity must be greater than zero.' });
        expect(validateEnergyEntryForm({ quantity: '40', price: '-1', odometer: '18010', date: '2026-09-03' })).toEqual({ ok: false, error: 'Total paid must be zero or greater.' });
        expect(validateEnergyEntryForm({ quantity: '40', price: '0', odometer: '18010', date: '2026-09-03' })).toMatchObject({ ok: true, value: { price: 0 } });
    });

    it('rejects a new entry odometer that regresses from the active vehicle', () => {
        expect(validateNewEntryOdometer(18_000, 18_000)).toEqual({ ok: true, value: 18_000 });
        expect(validateNewEntryOdometer(17_999, 18_000)).toEqual({ ok: false, error: 'Odometer cannot be lower than the current odometer.' });
    });

    it('rejects missing maintenance type and negative cost', () => {
        expect(validateMaintenanceEntryForm({ type: '', cost: '-25', odometer: '18010', date: '2026-09-03' })).toEqual({
            ok: false,
            error: 'Maintenance type is required.',
        });
    });

    it('rejects an impossible calendar date', () => {
        expect(validateMaintenanceEntryForm({ type: 'Oil service', cost: '95', odometer: '18010', date: '2026-02-30' })).toEqual({
            ok: false,
            error: 'Date must use YYYY-MM-DD.',
        });
    });

    it('validates every supported one-off ownership expense category with optional metadata', () => {
        Object.values(ExpenseCategory).forEach((category) => {
            expect(validateExpenseEntryForm({
                category,
                totalPaid: '48.50',
                date: '2026-09-03',
                odometer: '',
                description: 'Annual payment',
            })).toEqual({
                ok: true,
                value: {
                    category,
                    totalPaid: 48.5,
                    date: '2026-09-03T00:00:00.000Z',
                    odometer: undefined,
                    description: 'Annual payment',
                },
            });
        });
    });

    it('rejects invalid ownership expense amounts, categories, and odometers', () => {
        const base = { category: ExpenseCategory.Insurance, totalPaid: '40', date: '2026-09-03', odometer: '', description: '' };
        expect(validateExpenseEntryForm({ ...base, totalPaid: '0' })).toEqual({ ok: false, error: 'Total paid must be greater than zero.' });
        expect(validateExpenseEntryForm({ ...base, totalPaid: '-1' })).toEqual({ ok: false, error: 'Total paid must be greater than zero.' });
        expect(validateExpenseEntryForm({ ...base, totalPaid: 'not-money' })).toEqual({ ok: false, error: 'Total paid must be greater than zero.' });
        expect(validateExpenseEntryForm({ ...base, category: 'tyres' })).toEqual({ ok: false, error: 'Choose an expense category.' });
        expect(validateExpenseEntryForm({ ...base, odometer: '-1' })).toEqual({ ok: false, error: 'Odometer must be a whole number.' });
        expect(validateExpenseEntryForm({ ...base, odometer: '12.5' })).toEqual({ ok: false, error: 'Odometer must be a whole number.' });
    });

    it('validates a recurring schedule without asserting a payment', () => {
        expect(validateRecurringExpenseForm({ category: ExpenseCategory.Insurance, amount: '480', periodMonths: '12', startDate: '2026-01-01', nextDueDate: '', description: '' }))
            .toEqual({ ok: true, value: { category: ExpenseCategory.Insurance, amount: 480, periodMonths: 12, startDate: '2026-01-01T00:00:00.000Z', nextDueDate: undefined, description: undefined } });
        expect(validateRecurringExpenseForm({ category: ExpenseCategory.Insurance, amount: '0', periodMonths: '12', startDate: '2026-01-01', nextDueDate: '', description: '' })).toEqual({ ok: false, error: 'Amount must be greater than zero.' });
        expect(validateRecurringExpenseForm({ category: ExpenseCategory.Insurance, amount: '10', periodMonths: '2', startDate: '2026-01-01', nextDueDate: '', description: '' })).toEqual({ ok: false, error: 'Choose a recurrence.' });
    });
});
