import { describe, expect, it } from 'vitest';
import { decodeProblemDetails, decodePullResponse, ExpenseCategory, FuelFillStatus, SyncEntity, SyncOperation } from '../../src/domain/sync';

describe('decodePullResponse', () => {
    it('Given an ordered vehicle change, when decoding the response, then returns the canonical contract', () => {
        const response = decodePullResponse(
            {
                data: [{ sequence: 8, entityType: SyncEntity.Vehicle, operation: SyncOperation.Upsert, payload: vehiclePayload() }],
                nextCursor: 8,
            },
            7,
        );

        expect(response).toEqual({
            data: [{ sequence: 8, entityType: SyncEntity.Vehicle, operation: SyncOperation.Upsert, payload: vehiclePayload() }],
            nextCursor: 8,
        });
    });

    it('Given an unsupported entity, when decoding the response, then rejects the protocol violation', () => {
        expect(() =>
            decodePullResponse(
                {
                    data: [{ sequence: 8, entityType: 'unknown', operation: SyncOperation.Upsert, payload: vehiclePayload() }],
                    nextCursor: 8,
                },
                7,
            ),
        ).toThrow('Unsupported sync entity.');
    });

    it('Given an unordered batch, when decoding the response, then rejects before it reaches SQLite', () => {
        expect(() =>
            decodePullResponse(
                {
                    data: [
                        { sequence: 9, entityType: SyncEntity.Vehicle, operation: SyncOperation.Upsert, payload: vehiclePayload() },
                        {
                            sequence: 8,
                            entityType: SyncEntity.Vehicle,
                            operation: SyncOperation.Upsert,
                            payload: vehiclePayload('vehicle-2'),
                        },
                    ],
                    nextCursor: 8,
                },
                7,
            ),
        ).toThrow('Sync changes must be ordered by sequence.');
    });

    it('Given an entry tombstone, when decoding the response, then keeps its delete operation and client ID', () => {
        expect(
            decodePullResponse(
                {
                    data: [
                        {
                            sequence: 8,
                            entityType: SyncEntity.FuelEntry,
                            operation: SyncOperation.Delete,
                            payload: { clientId: 'fuel-1' },
                        },
                    ],
                    nextCursor: 8,
                },
                7,
            ),
        ).toEqual({
            data: [
                {
                    sequence: 8,
                    entityType: SyncEntity.FuelEntry,
                    operation: SyncOperation.Delete,
                    payload: { clientId: 'fuel-1' },
                },
            ],
            nextCursor: 8,
        });
    });

    it('Given a legacy remote fuel payload without a fill status, when decoding it, then defaults it to unknown', () => {
        const response = decodePullResponse(
            {
                data: [
                    {
                        sequence: 8,
                        entityType: SyncEntity.FuelEntry,
                        operation: SyncOperation.Upsert,
                        payload: {
                            clientId: 'fuel-1',
                            vehicleClientId: 'vehicle-1',
                            date: '2026-01-01T00:00:00.000Z',
                            liters: 40,
                            price: 70,
                            odometer: 12_000,
                        },
                    },
                ],
                nextCursor: 8,
            },
            7,
        );

        expect(response.data[0]).toMatchObject({
            payload: { clientId: 'fuel-1', fillStatus: FuelFillStatus.Unknown },
        });
    });

    it('Given vehicle payloads with and without a tracking date, when decoding them, then preserves the known date or uses null', () => {
        const known = decodePullResponse({
            data: [{ sequence: 8, entityType: SyncEntity.Vehicle, operation: SyncOperation.Upsert, payload: { ...vehiclePayload(), trackingStartDate: '2026-09-06' } }],
            nextCursor: 8,
        }, 7);
        const { trackingStartDate: _ignoredTrackingStartDate, ...legacyPayload } = vehiclePayload();
        const legacy = decodePullResponse({
            data: [{ sequence: 8, entityType: SyncEntity.Vehicle, operation: SyncOperation.Upsert, payload: legacyPayload }],
            nextCursor: 8,
        }, 7);

        expect(known.data[0]).toMatchObject({ payload: { trackingStartDate: '2026-09-06' } });
        expect(legacy.data[0]).toMatchObject({ payload: { trackingStartDate: null } });
    });

    it('Given a vehicle tombstone, when decoding the response, then preserves its delete operation and identity', () => {
        expect(decodePullResponse(
            { data: [{ sequence: 8, entityType: SyncEntity.Vehicle, operation: SyncOperation.Delete, payload: { clientId: 'vehicle-1' } }], nextCursor: 8 },
            7,
        )).toMatchObject({ data: [{ entityType: SyncEntity.Vehicle, operation: SyncOperation.Delete, payload: { clientId: 'vehicle-1' } }] });
    });

    it('decodes every valid ownership-expense category and rejects malformed expense payloads', () => {
        Object.values(ExpenseCategory).forEach((category) => {
            expect(decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.ExpenseEntry, operation: SyncOperation.Upsert, payload: { clientId: 'expense-1', vehicleClientId: 'vehicle-1', date: '2026-01-01T00:00:00.000Z', category, totalPaid: 10 } }], nextCursor: 8 }, 7).data[0])
                .toMatchObject({ payload: { category, odometer: undefined, description: undefined } });
        });
        expect(() => decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.ExpenseEntry, operation: SyncOperation.Upsert, payload: { clientId: 'expense-1', vehicleClientId: 'vehicle-1', date: 'invalid', category: 'tyres', totalPaid: 0 } }], nextCursor: 8 }, 7)).toThrow();
    });

    it('decodes active and inactive recurring schedules and rejects malformed schedule values', () => {
        for (const category of Object.values(ExpenseCategory)) {
            for (const active of [true, false]) {
                for (const periodMonths of [1, 3, 6, 12]) {
                const response = decodePullResponse({
                    data: [{
                        sequence: 8,
                        entityType: SyncEntity.RecurringExpense,
                        operation: SyncOperation.Upsert,
                        payload: {
                            clientId: `recurring-${periodMonths}-${active}`,
                            vehicleClientId: 'vehicle-1',
                            category,
                            amount: 480,
                            periodMonths,
                            startDate: '2026-01-01T00:00:00.000Z',
                            nextDueDate: '2027-01-01T00:00:00.000Z',
                            description: 'Policy',
                            active,
                        },
                    }],
                    nextCursor: 8,
                }, 7);

                    expect(response.data[0]).toMatchObject({ payload: { category, periodMonths, active } });
                }
            }
        }

        const invalidPayload = { clientId: 'recurring-invalid', vehicleClientId: 'vehicle-1', category: ExpenseCategory.Insurance, amount: 480, periodMonths: 2, startDate: '2026-01-01T00:00:00.000Z', active: true };
        expect(() => decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.RecurringExpense, operation: SyncOperation.Upsert, payload: invalidPayload }], nextCursor: 8 }, 7)).toThrow('Invalid periodMonths.');
        expect(() => decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.RecurringExpense, operation: SyncOperation.Upsert, payload: { ...invalidPayload, periodMonths: 12, amount: 0 } }], nextCursor: 8 }, 7)).toThrow('Invalid amount.');
        expect(() => decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.RecurringExpense, operation: SyncOperation.Upsert, payload: { ...invalidPayload, periodMonths: 12, startDate: 'invalid' } }], nextCursor: 8 }, 7)).toThrow('Invalid startDate.');
        expect(() => decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.RecurringExpense, operation: SyncOperation.Upsert, payload: { ...invalidPayload, periodMonths: 12, startDate: '2026-02-30T00:00:00.000Z' } }], nextCursor: 8 }, 7)).toThrow('Invalid startDate.');
        expect(() => decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.RecurringExpense, operation: SyncOperation.Upsert, payload: { ...invalidPayload, periodMonths: 12, nextDueDate: 'invalid' } }], nextCursor: 8 }, 7)).toThrow('Invalid nextDueDate.');
        expect(() => decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.RecurringExpense, operation: SyncOperation.Upsert, payload: { ...invalidPayload, periodMonths: 12, active: 'false' } }], nextCursor: 8 }, 7)).toThrow('Invalid active.');

        expect(decodePullResponse({ data: [{ sequence: 8, entityType: SyncEntity.RecurringExpense, operation: SyncOperation.Upsert, payload: { ...invalidPayload, periodMonths: 12 } }], nextCursor: 8 }, 7).data[0])
            .toMatchObject({ payload: { description: undefined, nextDueDate: undefined } });
    });
});

describe('decodeProblemDetails', () => {
    it('Given a Problem Details response, when decoding it, then preserves its user-safe detail', () => {
        expect(
            decodeProblemDetails({
                type: 'https://drivecost.app/problems/vehicle-not-found',
                title: 'Vehicle not found',
                status: 409,
                detail: 'Sync the vehicle before its fuel entry.',
                instance: '/fuel-entries',
            }),
        ).toEqual({
            type: 'https://drivecost.app/problems/vehicle-not-found',
            title: 'Vehicle not found',
            status: 409,
            detail: 'Sync the vehicle before its fuel entry.',
            instance: '/fuel-entries',
        });
    });

    it('Given a malformed error body, when decoding it, then declines to treat it as Problem Details', () => {
        expect(decodeProblemDetails({ title: 'Unknown failure', status: 500 })).toBeNull();
    });
});

function vehiclePayload(clientId = 'vehicle-1') {
    return {
        clientId,
        brand: 'Toyota',
        model: 'Corolla',
        year: 2022,
        ownershipStartMileage: 8_000,
        trackingStartMileage: 9_000,
        trackingStartDate: null,
        currentOdometer: 10_000,
    };
}
