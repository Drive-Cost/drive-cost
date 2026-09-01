import { describe, expect, it } from 'vitest';
import { decodeProblemDetails, decodePullResponse, SyncEntity, SyncOperation } from '../../src/domain/sync';

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

    it('Given a vehicle deletion, when decoding the response, then rejects the unsupported operation', () => {
        expect(() =>
            decodePullResponse(
                {
                    data: [
                        {
                            sequence: 8,
                            entityType: SyncEntity.Vehicle,
                            operation: SyncOperation.Delete,
                            payload: { clientId: 'vehicle-1' },
                        },
                    ],
                    nextCursor: 8,
                },
                7,
            ),
        ).toThrow('Unsupported sync operation.');
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
        currentOdometer: 10_000,
    };
}
