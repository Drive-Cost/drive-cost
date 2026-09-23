import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApp, JWT_AUDIENCE, JWT_ISSUER } from '../../../src/app';
import { readDatabase, writeDatabase } from '../../../src/lib/fileDatabase';

const testSecret = 'test-secret-that-is-at-least-thirty-two-characters';
const password = 'correct-horse-battery-staple';

test('register and login issue independently usable session credentials without storing refresh tokens raw', async () => {
    const app = await createApp({ jwtSecret: testSecret, logger: false });
    const email = `session-register-${randomUUID()}@drivecost.test`;
    try {
        const registration = await register(app, email);
        assertSessionResponse(registration, 'registered');
        const registrationBody = registration.json() as SessionBody;
        const accessClaims = app.jwt.decode(registrationBody.accessToken) as Record<string, unknown>;
        assert.equal(accessClaims.iss, JWT_ISSUER);
        assert.equal(accessClaims.aud, JWT_AUDIENCE);
        assert.equal(accessClaims.mode, 'registered');
        assert.equal(typeof accessClaims.sid, 'string');
        assert.equal(Number(accessClaims.exp) - Number(accessClaims.iat), 15 * 60);
        const storedSession = readDatabase().authSessions.find((session) => session.id === accessClaims.sid);
        assert.ok(storedSession);
        assert.match(storedSession.refreshTokenHash, /^[a-f0-9]{64}$/);
        assert.notEqual(storedSession.refreshTokenHash, registrationBody.refreshToken);
        const storedUser = readDatabase().users.find((user) => user.id === registrationBody.user.id)!;
        assert.notEqual(storedUser.passwordHash, password);

        const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
        assertSessionResponse(login, 'registered');
        assert.notEqual((login.json() as SessionBody).refreshToken, registrationBody.refreshToken);

        const wrongEmail = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: `missing-${randomUUID()}@drivecost.test`, password } });
        const wrongPassword = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'an-incorrect-password' } });
        assert.equal(wrongEmail.statusCode, 401);
        assert.equal(wrongPassword.statusCode, 401);
        assert.deepEqual(publicProblem(wrongEmail), publicProblem(wrongPassword));
    } finally {
        await app.close();
    }
});

test('access tokens enforce configured issuer, audience, signature, and expiry', async () => {
    const app = await createApp({ jwtSecret: testSecret, logger: false });
    try {
        const registration = await register(app, `access-${randomUUID()}@drivecost.test`);
        const body = registration.json() as SessionBody;
        assert.equal((await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(body.accessToken) })).statusCode, 200);

        const tampered = `${body.accessToken.slice(0, -1)}x`;
        assertUnauthorized(await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(tampered) }));
        const wrongIssuer = app.jwt.sign({ sub: body.user.id, mode: 'registered', sid: 'session_wrong' }, { iss: 'https://other.example', aud: JWT_AUDIENCE });
        assertUnauthorized(await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(wrongIssuer) }));
        const expired = app.jwt.sign({ sub: body.user.id, mode: 'registered', sid: 'session_expired' }, { expiresIn: -1 });
        assertUnauthorized(await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(expired) }));
    } finally {
        await app.close();
    }
});

test('refresh rotation, logout, multi-device sessions, and expiry keep sessions independent', async () => {
    const app = await createApp({ jwtSecret: testSecret, logger: false });
    try {
        const email = `refresh-${randomUUID()}@drivecost.test`;
        const deviceA = (await register(app, email)).json() as SessionBody;
        const deviceB = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })).json() as SessionBody;

        const rotated = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: deviceA.refreshToken } });
        assertSessionResponse(rotated, 'registered');
        const rotatedBody = rotated.json() as SessionBody;
        assert.notEqual(rotatedBody.refreshToken, deviceA.refreshToken);
        assertUnauthorized(await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: deviceA.refreshToken } }));

        const concurrent = await Promise.all([
            app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: rotatedBody.refreshToken } }),
            app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: rotatedBody.refreshToken } }),
        ]);
        assert.deepEqual(concurrent.map((response) => response.statusCode).sort(), [200, 401]);
        const currentA = concurrent.find((response) => response.statusCode === 200)!.json() as SessionBody;

        assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: currentA.refreshToken } })).statusCode, 204);
        assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: currentA.refreshToken } })).statusCode, 204);
        assertUnauthorized(await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: currentA.refreshToken } }));
        const refreshedDeviceB = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: deviceB.refreshToken } });
        assertSessionResponse(refreshedDeviceB, 'registered');
        const refreshedDeviceBBody = refreshedDeviceB.json() as SessionBody;

        const expiringSessionId = (app.jwt.decode(refreshedDeviceBBody.accessToken) as { sid: string }).sid;
        const database = readDatabase();
        const expiringSession = database.authSessions.find((session) => session.id === expiringSessionId)!;
        expiringSession.expiresAt = new Date(Date.now() - 1_000).toISOString();
        writeDatabase(database);
        assertUnauthorized(await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: refreshedDeviceBBody.refreshToken } }));
    } finally {
        await app.close();
    }
});

test('a guest upgrades atomically without changing user-owned sync data', async () => {
    const app = await createApp({ jwtSecret: testSecret, logger: false });
    try {
        const guestResponse = await app.inject({ method: 'POST', url: '/auth/guest' });
        assertSessionResponse(guestResponse, 'guest');
        const guest = guestResponse.json() as SessionBody;
        const vehicle = {
            clientId: `guest-vehicle-${randomUUID()}`, brand: 'Toyota', model: 'Yaris', year: 2022,
            ownershipStartMileage: 1_000, trackingStartMileage: 1_500, currentOdometer: 2_000,
        };
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers: bearer(guest.accessToken), payload: vehicle })).statusCode, 201);
        const upgrade = await app.inject({ method: 'POST', url: '/auth/upgrade', headers: bearer(guest.accessToken), payload: { email: `upgraded-${randomUUID()}@drivecost.test`, password } });
        assertSessionResponse(upgrade, 'registered');
        const upgraded = upgrade.json() as SessionBody;
        assert.equal(upgraded.user.id, guest.user.id);
        assert.equal((await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(upgraded.accessToken) })).json().data[0].clientId, vehicle.clientId);
        assert.equal((await app.inject({ method: 'GET', url: '/sync?after=0', headers: bearer(upgraded.accessToken) })).json().data[0].payload.clientId, vehicle.clientId);
        assertUnauthorized(await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: guest.refreshToken } }));
        assert.equal((await app.inject({ method: 'POST', url: '/auth/upgrade', headers: bearer(upgraded.accessToken), payload: { email: `again-${randomUUID()}@drivecost.test`, password } })).statusCode, 409);

        const existing = `collision-${randomUUID()}@drivecost.test`;
        await register(app, existing);
        const collisionGuest = (await app.inject({ method: 'POST', url: '/auth/guest' })).json() as SessionBody;
        const collision = await app.inject({ method: 'POST', url: '/auth/upgrade', headers: bearer(collisionGuest.accessToken), payload: { email: existing, password } });
        assert.equal(collision.statusCode, 409);
        assert.equal((await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(collisionGuest.accessToken) })).statusCode, 200);
    } finally {
        await app.close();
    }
});

test('public authentication endpoints allow normal use then apply the per-IP beta limit', async () => {
    const app = await createApp({ jwtSecret: testSecret, logger: false });
    try {
        for (let index = 0; index < 10; index += 1) {
            assert.equal((await app.inject({ method: 'POST', url: '/auth/guest' })).statusCode, 201);
        }
        const limited = await app.inject({ method: 'POST', url: '/auth/guest' });
        assert.equal(limited.statusCode, 429);
        assert.equal((limited.json() as { type: string }).type, 'https://drivecost.app/problems/rate-limited');
    } finally {
        await app.close();
    }
});

interface SessionBody {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    user: { id: string; mode: 'guest' | 'registered'; email?: string };
}

async function register(app: Awaited<ReturnType<typeof createApp>>, email: string) {
    const response = await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password } });
    assert.equal(response.statusCode, 201);
    return response;
}

function assertSessionResponse(response: { statusCode: number; json: () => unknown }, mode: 'guest' | 'registered') {
    assert.equal(response.statusCode === 200 || response.statusCode === 201, true);
    const body = response.json() as SessionBody;
    assert.equal(typeof body.accessToken, 'string');
    assert.equal(typeof body.refreshToken, 'string');
    assert.match(body.accessTokenExpiresAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(body.user.mode, mode);
}

function bearer(accessToken: string) {
    return { authorization: `Bearer ${accessToken}` };
}

function assertUnauthorized(response: { statusCode: number; json: () => unknown }) {
    assert.equal(response.statusCode, 401);
    assert.equal((response.json() as { type: string }).type, 'https://drivecost.app/problems/unauthorized');
}

function publicProblem(response: { json: () => unknown }) {
    const body = response.json() as { type: string; title: string; status: number };
    return { type: body.type, title: body.title, status: body.status };
}
