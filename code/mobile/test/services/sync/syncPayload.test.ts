import { describe, expect, it } from 'vitest';
import {
    toFuelEntrySyncPayload,
    toMaintenanceEntrySyncPayload,
    toVehicleSyncPayload,
    toExpenseEntrySyncPayload,
    toRecurringExpenseSyncPayload,
} from '../../../src/services/sync/syncPayload';
import { FuelFillStatus } from '../../../src/models/FuelEntry';
import { ExpenseCategory } from '../../../src/models/ExpenseEntry';

const VEHICLE_CLIENT_ID = 'vehicle-client-1';

describe('toVehicleSyncPayload', () => {
    it('Given a persisted vehicle, when preparing it for sync, then excludes device-only fields', () => {
        const payload = toVehicleSyncPayload({
            id: 42,
            clientId: 'vehicle-1',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2022,
            ownershipStartMileage: 12_000,
            trackingStartMileage: 15_000,
            trackingStartDate: '2026-09-06',
            currentOdometer: 18_000,
            currentMileage: 18_000,
        });

        expect(payload).toEqual({
            clientId: 'vehicle-1',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2022,
            ownershipStartMileage: 12_000,
            trackingStartMileage: 15_000,
            trackingStartDate: '2026-09-06',
            currentOdometer: 18_000,
        });
    });

    it('Given a vehicle without a client ID, when preparing it for sync, then rejects it', () => {
        expect(() =>
            toVehicleSyncPayload({
                brand: 'Toyota',
                model: 'Corolla',
                year: 2022,
                ownershipStartMileage: 12_000,
                trackingStartMileage: 15_000,
                currentOdometer: 18_000,
            }),
        ).toThrow('Cannot sync a vehicle without a client ID.');
    });
});

describe('entry sync payloads', () => {
    it('Given edited entries, when creating sync payloads, then preserves their client-owned identities', () => {
        expect(
            toFuelEntrySyncPayload(
                {
                    id: 41,
                    clientId: 'fuel-client-1',
                    vehicleId: 7,
                    date: '2026-09-02T12:00:00.000Z',
                    liters: 40.5,
                    price: 73.2,
                    odometer: 20_500,
                    fillStatus: FuelFillStatus.Full,
                },
                VEHICLE_CLIENT_ID,
            ),
        ).toMatchObject({ clientId: 'fuel-client-1', vehicleClientId: VEHICLE_CLIENT_ID, liters: 40.5, fillStatus: 'full' });

        expect(
            toMaintenanceEntrySyncPayload(
                {
                    id: 42,
                    clientId: 'maintenance-client-1',
                    vehicleId: 7,
                    type: 'Oil service',
                    description: 'Oil and filter replacement',
                    cost: 95,
                    date: '2026-09-02T13:00:00.000Z',
                    odometer: 20_600,
                },
                VEHICLE_CLIENT_ID,
            ),
        ).toMatchObject({ clientId: 'maintenance-client-1', vehicleClientId: VEHICLE_CLIENT_ID, cost: 95 });
    });

    it('keeps ownership expense identity and optional fields in its sync payload', () => {
        expect(toExpenseEntrySyncPayload({ id: 9, clientId: 'expense-client-9', vehicleId: 7, date: '2026-09-02T12:00:00.000Z', category: ExpenseCategory.Insurance, totalPaid: 480 }, VEHICLE_CLIENT_ID))
            .toEqual({ clientId: 'expense-client-9', vehicleClientId: VEHICLE_CLIENT_ID, date: '2026-09-02T12:00:00.000Z', category: 'insurance', totalPaid: 480, description: undefined, odometer: undefined });
    });

    it('keeps recurring schedule identity and its active state in the sync payload', () => {
        expect(toRecurringExpenseSyncPayload({
            id: 10,
            clientId: 'recurring-client-10',
            vehicleId: 7,
            category: ExpenseCategory.Insurance,
            amount: 480,
            periodMonths: 12,
            startDate: '2026-01-01T00:00:00.000Z',
            nextDueDate: '2027-01-01T00:00:00.000Z',
            description: 'Policy',
            active: false,
        }, VEHICLE_CLIENT_ID)).toEqual({
            clientId: 'recurring-client-10',
            vehicleClientId: VEHICLE_CLIENT_ID,
            category: 'insurance',
            amount: 480,
            periodMonths: 12,
            startDate: '2026-01-01T00:00:00.000Z',
            nextDueDate: '2027-01-01T00:00:00.000Z',
            description: 'Policy',
            active: false,
        });
    });
});
