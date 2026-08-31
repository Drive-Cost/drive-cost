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
                currentOdometer: 18000,
            },
        });

        assert.equal(createdVehicle.statusCode, 201);
        assert.equal(createdVehicle.json().data.clientId, 'vehicle_1');
        assert.equal('userId' in createdVehicle.json().data, false);

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
