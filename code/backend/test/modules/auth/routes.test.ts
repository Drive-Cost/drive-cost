import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApp } from '../../../src/app';

const testSecret = 'test-secret-that-is-at-least-thirty-two-characters';

test('Given a registered user, when syncing vehicle data, then ownership and validation are enforced', async () => {
    const app = await createApp({ jwtSecret: testSecret, logger: false });
    const email = `test-${randomUUID()}@drivecost.test`;

    try {
        const registration = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { email, password: 'correct-horse-battery-staple' },
        });

        assert.equal(registration.statusCode, 201);
        const accessToken = registration.json().accessToken as string;
        assert.ok(accessToken);

        const unauthorized = await app.inject({ method: 'POST', url: '/vehicles', payload: {} });
        assert.equal(unauthorized.statusCode, 401);
        assertProblem(unauthorized, 'https://drivecost.app/problems/unauthorized', 'Authentication required');

        const invalidVehicle = await app.inject({
            method: 'POST',
            url: '/vehicles',
            headers: { authorization: `Bearer ${accessToken}` },
            payload: { clientId: 'vehicle_1' },
        });
        assert.equal(invalidVehicle.statusCode, 400);
        assertProblem(invalidVehicle, 'https://drivecost.app/problems/invalid-request', 'Invalid request');

        const createdVehicle = await app.inject({
            method: 'POST',
            url: '/vehicles',
            headers: { authorization: `Bearer ${accessToken}` },
            payload: {
                clientId: 'vehicle_1',
                brand: 'Toyota',
                model: 'Corolla',
                year: 2022,
                ownershipStartMileage: 12000,
                trackingStartMileage: 15000,
                trackingStartDate: '2026-09-06',
                currentOdometer: 18000,
            },
        });

        assert.equal(createdVehicle.statusCode, 201);
        assert.equal(createdVehicle.json().data.clientId, 'vehicle_1');
        assert.equal(createdVehicle.json().data.trackingStartDate, '2026-09-06');
        assert.equal('userId' in createdVehicle.json().data, false);

        const invalidTrackingDate = await app.inject({
            method: 'POST',
            url: '/vehicles',
            headers: { authorization: `Bearer ${accessToken}` },
            payload: {
                clientId: 'vehicle_2', brand: 'Toyota', model: 'Corolla', year: 2022,
                ownershipStartMileage: 12000, trackingStartMileage: 15000,
                trackingStartDate: '2026-02-30', currentOdometer: 18000,
            },
        });
        assert.equal(invalidTrackingDate.statusCode, 400);

        const vehicles = await app.inject({
            method: 'GET',
            url: '/vehicles',
            headers: { authorization: `Bearer ${accessToken}` },
        });
        assert.equal(vehicles.statusCode, 200);
        assert.equal(vehicles.json().data.length, 1);

        const changes = await app.inject({
            method: 'GET',
            url: '/sync?after=0',
            headers: { authorization: `Bearer ${accessToken}` },
        });
        assert.equal(changes.statusCode, 200);
        assert.equal(changes.json().data[0].clientId, 'vehicle_1');
        assert.equal(changes.json().data[0].payload.clientId, 'vehicle_1');
        assert.equal(changes.json().data[0].operation, 'upsert');

        const fuelEntry = {
            clientId: 'fuel_1',
            vehicleClientId: 'vehicle_1',
            date: '2026-09-02T12:00:00.000Z',
            liters: 42,
            price: 75,
            odometer: 18_100,
            fillStatus: 'full',
        };
        const createdFuelEntry = await app.inject({
            method: 'POST',
            url: '/fuel-entries',
            headers: { authorization: `Bearer ${accessToken}` },
            payload: fuelEntry,
        });
        assert.equal(createdFuelEntry.statusCode, 201);

        const expense = { clientId: 'expense_1', vehicleClientId: 'vehicle_1', date: '2026-09-03T12:00:00.000Z', category: 'insurance', totalPaid: 480 };
        const createdExpense = await app.inject({ method: 'POST', url: '/ownership-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: expense });
        assert.equal(createdExpense.statusCode, 201);
        const updatedExpense = await app.inject({ method: 'POST', url: '/ownership-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: { ...expense, totalPaid: 500, description: 'Renewal' } });
        assert.equal(updatedExpense.statusCode, 201);
        assert.equal(updatedExpense.json().data.id, createdExpense.json().data.id);
        const malformedExpense = await app.inject({ method: 'POST', url: '/ownership-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: { ...expense, clientId: 'expense_bad', category: 'tyres' } });
        assert.equal(malformedExpense.statusCode, 400);

        const recurringExpense = {
            clientId: 'recurring_1', vehicleClientId: 'vehicle_1', category: 'insurance', amount: 480,
            periodMonths: 12, startDate: '2026-09-03T00:00:00.000Z', active: true,
        };
        const createdRecurringExpense = await app.inject({ method: 'POST', url: '/recurring-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: recurringExpense });
        assert.equal(createdRecurringExpense.statusCode, 201);
        const deactivatedRecurringExpense = await app.inject({ method: 'POST', url: '/recurring-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: { ...recurringExpense, active: false, amount: 500 } });
        assert.equal(deactivatedRecurringExpense.statusCode, 201);
        assert.equal(deactivatedRecurringExpense.json().data.id, createdRecurringExpense.json().data.id);
        assert.equal(deactivatedRecurringExpense.json().data.active, false);
        const reactivatedRecurringExpense = await app.inject({ method: 'POST', url: '/recurring-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: { ...recurringExpense, active: true, amount: 500 } });
        assert.equal(reactivatedRecurringExpense.statusCode, 201);
        assert.equal(reactivatedRecurringExpense.json().data.id, createdRecurringExpense.json().data.id);
        const malformedRecurringExpense = await app.inject({ method: 'POST', url: '/recurring-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: { ...recurringExpense, clientId: 'recurring_bad', periodMonths: 2 } });
        assert.equal(malformedRecurringExpense.statusCode, 400);
        const otherRegistration = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `other-${randomUUID()}@drivecost.test`, password: 'correct-horse-battery-staple' } });
        const otherUserRecurringExpense = await app.inject({ method: 'POST', url: '/recurring-expenses', headers: { authorization: `Bearer ${otherRegistration.json().accessToken as string}` }, payload: { ...recurringExpense, clientId: 'recurring_other' } });
        assert.equal(otherUserRecurringExpense.statusCode, 409);
        const deletedRecurringExpense = await app.inject({ method: 'DELETE', url: '/recurring-expenses/recurring_1', headers: { authorization: `Bearer ${accessToken}` } });
        assert.equal(deletedRecurringExpense.statusCode, 204);
        const repeatedRecurringDelete = await app.inject({ method: 'DELETE', url: '/recurring-expenses/recurring_1', headers: { authorization: `Bearer ${accessToken}` } });
        assert.equal(repeatedRecurringDelete.statusCode, 204);
        const staleRecurringReplay = await app.inject({ method: 'POST', url: '/recurring-expenses', headers: { authorization: `Bearer ${accessToken}` }, payload: recurringExpense });
        assert.equal(staleRecurringReplay.statusCode, 204);

        const deletedExpense = await app.inject({ method: 'DELETE', url: '/ownership-expenses/expense_1', headers: { authorization: `Bearer ${accessToken}` } });
        assert.equal(deletedExpense.statusCode, 204);

        const deletedFuelEntry = await app.inject({
            method: 'DELETE',
            url: `/fuel-entries/${fuelEntry.clientId}`,
            headers: { authorization: `Bearer ${accessToken}` },
        });
        assert.equal(deletedFuelEntry.statusCode, 204);

        const staleFuelReplay = await app.inject({
            method: 'POST',
            url: '/fuel-entries',
            headers: { authorization: `Bearer ${accessToken}` },
            payload: fuelEntry,
        });
        assert.equal(staleFuelReplay.statusCode, 204);

        const entryChanges = await app.inject({
            method: 'GET',
            url: `/sync?after=${changes.json().nextCursor}`,
            headers: { authorization: `Bearer ${accessToken}` },
        });
        assert.equal(entryChanges.statusCode, 200);
        assert.deepEqual(
            entryChanges.json().data.map((change: { operation: string }) => change.operation),
            ['upsert', 'upsert', 'upsert', 'upsert', 'upsert', 'upsert', 'delete', 'delete', 'delete'],
        );
        assert.equal(entryChanges.json().data[0].payload.fillStatus, 'full');
        assert.equal(entryChanges.json().data.at(-1).payload.clientId, fuelEntry.clientId);
        assert.equal(entryChanges.json().data.filter((change: { payload: { clientId: string } }) => change.payload.clientId === expense.clientId).at(-1)?.operation, 'delete');
        assert.equal(entryChanges.json().data.filter((change: { payload: { clientId: string } }) => change.payload.clientId === recurringExpense.clientId).at(-1)?.operation, 'delete');
    } finally {
        await app.close();
    }
});

function assertProblem(
    response: { headers: { 'content-type'?: string | string[] | number }; json: () => unknown },
    type: string,
    title: string,
) {
    const contentType = response.headers['content-type'];
    assert.equal(typeof contentType === 'string' && contentType.startsWith('application/problem+json'), true);

    const body = response.json() as Record<string, unknown>;
    assert.equal(body.type, type);
    assert.equal(body.title, title);
    assert.equal(typeof body.status, 'number');
    assert.equal(typeof body.instance, 'string');
}

test('Given a vehicle deletion, when a stale device reconnects, then neither the vehicle nor its child data can be resurrected', async () => {
    const app = await createApp({ jwtSecret: testSecret, logger: false });
    const email = `delete-${randomUUID()}@drivecost.test`;

    try {
        const registration = await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'correct-horse-battery-staple' } });
        const accessToken = registration.json().accessToken as string;
        const headers = { authorization: `Bearer ${accessToken}` };
        const vehicle = {
            clientId: 'vehicle_delete_1', brand: 'Audi', model: 'A4', year: 2022,
            ownershipStartMileage: 1_000, trackingStartMileage: 1_000, currentOdometer: 2_000,
        };
        const fuel = {
            clientId: 'fuel_delete_1', vehicleClientId: vehicle.clientId, date: '2026-09-12T10:00:00.000Z',
            liters: 40, price: 70, odometer: 2_000, fillStatus: 'full',
        };

        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers, payload: vehicle })).statusCode, 201);
        assert.equal((await app.inject({ method: 'POST', url: '/fuel-entries', headers, payload: fuel })).statusCode, 201);
        assert.equal((await app.inject({ method: 'DELETE', url: `/vehicles/${vehicle.clientId}`, headers })).statusCode, 204);
        assert.equal((await app.inject({ method: 'DELETE', url: `/vehicles/${vehicle.clientId}`, headers })).statusCode, 204);

        const vehicles = await app.inject({ method: 'GET', url: '/vehicles', headers });
        assert.deepEqual(vehicles.json(), { data: [] });
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers, payload: vehicle })).statusCode, 204);
        assert.equal((await app.inject({ method: 'POST', url: '/fuel-entries', headers, payload: fuel })).statusCode, 204);

        const changes = (await app.inject({ method: 'GET', url: '/sync?after=0', headers })).json().data as Array<{ entityType: string; operation: string; payload: { clientId: string } }>;
        expectDeleteChanges(changes, vehicle.clientId, fuel.clientId);

        const other = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `other-delete-${randomUUID()}@drivecost.test`, password: 'correct-horse-battery-staple' } });
        const otherHeaders = { authorization: `Bearer ${other.json().accessToken as string}` };
        assert.equal((await app.inject({ method: 'DELETE', url: `/vehicles/${vehicle.clientId}`, headers: otherHeaders })).statusCode, 204);
        assert.deepEqual((await app.inject({ method: 'GET', url: '/vehicles', headers: otherHeaders })).json(), { data: [] });
    } finally {
        await app.close();
    }
});

function expectDeleteChanges(changes: Array<{ entityType: string; operation: string; payload: { clientId: string } }>, vehicleClientId: string, fuelClientId: string) {
    assert.equal(changes.filter((change) => change.entityType === 'vehicle' && change.operation === 'delete' && change.payload.clientId === vehicleClientId).length, 1);
    assert.equal(changes.filter((change) => change.entityType === 'fuel_entry' && change.operation === 'delete' && change.payload.clientId === fuelClientId).length, 1);
}
