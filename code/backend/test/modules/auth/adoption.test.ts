import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AdoptionProtocol } from '@drivecost/contracts';
import { createApp } from '../../../src/app';

const vehicle = { clientId: 'legacy-vehicle-1', brand: 'Toyota', model: 'Corolla', year: 2022,
  ownershipStartMileage: 1000, trackingStartMileage: 1000, currentOdometer: 1500 };

test('adoption creates or replays identical content but cannot overwrite an account collision or tombstone', async () => {
  const app = await createApp({ jwtSecret: 'test-secret-that-is-at-least-thirty-two-characters', logger: false });
  try {
    const registration = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${randomUUID()}@drivecost.test`, password: 'correct-horse-battery-staple' } });
    const headers = { authorization: `Bearer ${registration.json().accessToken as string}` };
    const guarded = { ...headers, [AdoptionProtocol.header]: AdoptionProtocol.version };
    assert.equal((await app.inject({ method: 'GET', url: '/sync?after=0', headers })).headers[AdoptionProtocol.header], AdoptionProtocol.version);
    const first = await app.inject({ method: 'POST', url: '/vehicles', headers: guarded, payload: vehicle });
    assert.equal(first.statusCode, 201);
    const beforeReplay = (await app.inject({ method: 'GET', url: '/sync?after=0', headers })).json();
    const replay = await app.inject({ method: 'POST', url: '/vehicles', headers: guarded, payload: vehicle });
    assert.equal(replay.statusCode, 201); assert.equal(replay.json().data.id, first.json().data.id);
    assert.deepEqual((await app.inject({ method: 'GET', url: '/sync?after=0', headers })).json(), beforeReplay);
    const collision = await app.inject({ method: 'POST', url: '/vehicles', headers: guarded, payload: { ...vehicle, model: 'Unrelated local car' } });
    assert.equal((await app.inject({ method: 'POST', url: '/vehicles/adoption', headers, payload: { ...vehicle, model: 'Guard cannot be disabled' } })).statusCode, 409);
    assert.equal(collision.statusCode, 409); assert.equal(collision.json().type, 'https://drivecost.app/problems/adoption-conflict');
    assert.equal((await app.inject({ method: 'GET', url: '/vehicles', headers })).json().data[0].model, 'Corolla');
    const expense = { clientId: 'expense-1', vehicleClientId: vehicle.clientId, date: '2026-10-11T00:00:00.000Z', category: 'insurance', totalPaid: 500 };
    assert.equal((await app.inject({ method: 'POST', url: '/ownership-expenses', headers: guarded, payload: expense })).statusCode, 201);
    assert.equal((await app.inject({ method: 'POST', url: '/ownership-expenses', headers: guarded, payload: { ...expense, totalPaid: 900 } })).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `/vehicles/${vehicle.clientId}`, headers })).statusCode, 204);
    assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers: guarded, payload: vehicle })).statusCode, 409);
    assert.equal((await app.inject({ method: 'POST', url: '/ownership-expenses', headers: guarded, payload: expense })).statusCode, 409);
    const other = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${randomUUID()}@drivecost.test`, password: 'correct-horse-battery-staple' } });
    assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers: { authorization: `Bearer ${other.json().accessToken as string}`, [AdoptionProtocol.header]: AdoptionProtocol.version }, payload: vehicle })).statusCode, 201);
    assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers: { ...headers, [AdoptionProtocol.header]: 'invalid' }, payload: vehicle })).statusCode, 400);
  } finally { await app.close(); }
});
