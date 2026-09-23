import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import postgres from 'postgres';
import { SyncEntity } from '@drivecost/contracts';
import { createApp } from '../../../src/app';
import { PostgresRepository } from '../../../src/platform/persistence/postgresRepository';

const databaseUrl = process.env.DATABASE_URL;
const testSecret = 'test-secret-that-is-at-least-thirty-two-characters';

test('Postgres persists idempotent, user-scoped vehicle sync', { skip: !databaseUrl }, async () => {
    const app = await createApp({
        jwtSecret: testSecret,
        logger: false,
        repository: new PostgresRepository(databaseUrl!),
    });
    const email = `postgres-${randomUUID()}@drivecost.test`;

    try {
        const registration = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { email, password: 'correct-horse-battery-staple' },
        });
        assert.equal(registration.statusCode, 201);
        const accessToken = registration.json().accessToken as string;

        const vehicle = {
            clientId: 'vehicle_integration_1',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2022,
            ownershipStartMileage: 12000,
            trackingStartMileage: 15000,
            trackingStartDate: '2026-09-06',
            currentOdometer: 18000,
        };

        const created = await app.inject({
            method: 'POST',
            url: '/vehicles',
            headers: { authorization: `Bearer ${accessToken}` },
            payload: vehicle,
        });
        assert.equal(created.statusCode, 201);

        const updated = await app.inject({
            method: 'POST',
            url: '/vehicles',
            headers: { authorization: `Bearer ${accessToken}` },
            payload: { ...vehicle, currentOdometer: 18500 },
        });
        assert.equal(updated.statusCode, 201);
        assert.equal(updated.json().data.id, created.json().data.id);

        const vehicles = await app.inject({
            method: 'GET',
            url: '/vehicles',
            headers: { authorization: `Bearer ${accessToken}` },
        });
        assert.equal(vehicles.statusCode, 200);
        const [storedVehicle] = vehicles.json().data as Array<Record<string, unknown>>;
        assert.equal(storedVehicle.clientId, vehicle.clientId);
        assert.equal(storedVehicle.brand, vehicle.brand);
        assert.equal(storedVehicle.currentOdometer, 18500);
        assert.equal(storedVehicle.trackingStartDate, '2026-09-06');
        assert.equal(storedVehicle.id, created.json().data.id);
        assert.match(storedVehicle.createdAt as string, /^\d{4}-\d{2}-\d{2}T/);
        assert.match(storedVehicle.updatedAt as string, /^\d{4}-\d{2}-\d{2}T/);

        const firstPull = await app.inject({
            method: 'GET',
            url: '/sync?after=0',
            headers: { authorization: `Bearer ${accessToken}` },
        });
        assert.equal(firstPull.statusCode, 200);
        const firstPullBody = firstPull.json();
        assert.equal(firstPullBody.data.length, 2);
        assert.equal(typeof firstPullBody.nextCursor, 'number');
        assert.equal(firstPullBody.data.at(-1).payload.currentOdometer, 18500);
        assert.equal(firstPullBody.data.at(-1).payload.clientId, vehicle.clientId);

        const secondPull = await app.inject({
            method: 'GET',
            url: `/sync?after=${firstPullBody.nextCursor}`,
            headers: { authorization: `Bearer ${accessToken}` },
        });
        assert.equal(secondPull.statusCode, 200);
        assert.deepEqual(secondPull.json(), { data: [], nextCursor: firstPullBody.nextCursor });
    } finally {
        await app.close();
    }
});

test('Postgres propagates vehicle and entry changes between two device cursors', { skip: !databaseUrl }, async () => {
    const app = await createApp({
        jwtSecret: testSecret,
        logger: false,
        repository: new PostgresRepository(databaseUrl!),
    });
    const email = `two-device-${randomUUID()}@drivecost.test`;

    try {
        const registration = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { email, password: 'correct-horse-battery-staple' },
        });
        assert.equal(registration.statusCode, 201);
        const accessToken = registration.json().accessToken as string;
        const headers = { authorization: `Bearer ${accessToken}` };

        const vehicle = {
            clientId: 'vehicle_two_device_1',
            brand: 'Honda',
            model: 'Civic',
            year: 2021,
            ownershipStartMileage: 5_000,
            trackingStartMileage: 7_000,
            currentOdometer: 12_000,
        };

        const createdVehicle = await app.inject({ method: 'POST', url: '/vehicles', headers, payload: vehicle });
        assert.equal(createdVehicle.statusCode, 201);

        const createdFuelEntry = await app.inject({
            method: 'POST',
            url: '/fuel-entries',
            headers,
            payload: {
                clientId: 'fuel_two_device_1',
                vehicleClientId: vehicle.clientId,
                date: '2026-07-26T08:00:00.000Z',
                liters: 42.5,
                price: 75.2,
                odometer: 12_100,
                fillStatus: 'full',
            },
        });
        assert.equal(createdFuelEntry.statusCode, 201);

        const createdMaintenanceEntry = await app.inject({
            method: 'POST',
            url: '/maintenance-entries',
            headers,
            payload: {
                clientId: 'maintenance_two_device_1',
                vehicleClientId: vehicle.clientId,
                date: '2026-07-26T09:00:00.000Z',
                type: 'Oil service',
                description: 'Oil and filter replacement',
                cost: 95,
                odometer: 12_150,
            },
        });
        assert.equal(createdMaintenanceEntry.statusCode, 201);

        const createdRecurringExpense = await app.inject({
            method: 'POST',
            url: '/recurring-expenses',
            headers,
            payload: {
                clientId: 'recurring_two_device_1',
                vehicleClientId: vehicle.clientId,
                category: 'insurance',
                amount: 480,
                periodMonths: 12,
                startDate: '2026-07-01T00:00:00.000Z',
                active: true,
            },
        });
        assert.equal(createdRecurringExpense.statusCode, 201);

        const deactivatedRecurringExpense = await app.inject({
            method: 'POST',
            url: '/recurring-expenses',
            headers,
            payload: {
                clientId: 'recurring_two_device_1',
                vehicleClientId: vehicle.clientId,
                category: 'insurance',
                amount: 480,
                periodMonths: 12,
                startDate: '2026-07-01T00:00:00.000Z',
                active: false,
            },
        });
        assert.equal(deactivatedRecurringExpense.statusCode, 201);
        assert.equal(deactivatedRecurringExpense.json().data.id, createdRecurringExpense.json().data.id);

        const deviceBInitialPull = await app.inject({ method: 'GET', url: '/sync?after=0', headers });
        assert.equal(deviceBInitialPull.statusCode, 200);
        const initialBody = deviceBInitialPull.json();
        assert.deepEqual(
            initialBody.data.map((change: { entityType: string }) => change.entityType),
            ['vehicle', 'fuel_entry', 'maintenance_entry', 'recurring_expense', 'recurring_expense'],
        );
        assert.equal(initialBody.data[0].payload.clientId, vehicle.clientId);
        assert.equal(initialBody.data[1].payload.vehicleClientId, vehicle.clientId);
        assert.equal(initialBody.data[1].payload.fillStatus, 'full');
        assert.equal(initialBody.data[2].payload.vehicleClientId, vehicle.clientId);
        assert.equal(initialBody.data[4].payload.active, false);

        const deviceBUpdate = await app.inject({
            method: 'POST',
            url: '/vehicles',
            headers,
            payload: { ...vehicle, currentOdometer: 12_500 },
        });
        assert.equal(deviceBUpdate.statusCode, 201);
        assert.equal(deviceBUpdate.json().data.id, createdVehicle.json().data.id);

        const deviceAIncrementalPull = await app.inject({
            method: 'GET',
            url: `/sync?after=${initialBody.nextCursor}`,
            headers,
        });
        assert.equal(deviceAIncrementalPull.statusCode, 200);
        assert.equal(deviceAIncrementalPull.json().data.length, 1);
        assert.equal(deviceAIncrementalPull.json().data[0].payload.clientId, vehicle.clientId);
        assert.equal(deviceAIncrementalPull.json().data[0].payload.currentOdometer, 12_500);

        const deleteFromDeviceB = await app.inject({
            method: 'DELETE',
            url: '/fuel-entries/fuel_two_device_1',
            headers,
        });
        assert.equal(deleteFromDeviceB.statusCode, 204);

        const deviceADeletionPull = await app.inject({
            method: 'GET',
            url: `/sync?after=${deviceAIncrementalPull.json().nextCursor}`,
            headers,
        });
        assert.equal(deviceADeletionPull.statusCode, 200);
        const [deletionChange] = deviceADeletionPull.json().data;
        assert.equal(deletionChange.sequence, deviceADeletionPull.json().nextCursor);
        assert.equal(deletionChange.entityType, 'fuel_entry');
        assert.equal(deletionChange.operation, 'delete');
        assert.equal(deletionChange.entityId, createdFuelEntry.json().data.id);
        assert.equal(deletionChange.clientId, 'fuel_two_device_1');
        assert.deepEqual(deletionChange.payload, { clientId: 'fuel_two_device_1' });

        const staleFuelReplay = await app.inject({
            method: 'POST',
            url: '/fuel-entries',
            headers,
            payload: {
                clientId: 'fuel_two_device_1',
                vehicleClientId: vehicle.clientId,
                date: '2026-07-26T08:00:00.000Z',
                liters: 42.5,
                price: 75.2,
                odometer: 12_100,
                fillStatus: 'full',
            },
        });
        assert.equal(staleFuelReplay.statusCode, 204);

        const noResurrectionChange = await app.inject({
            method: 'GET',
            url: `/sync?after=${deviceADeletionPull.json().nextCursor}`,
            headers,
        });
        assert.deepEqual(noResurrectionChange.json(), {
            data: [],
            nextCursor: deviceADeletionPull.json().nextCursor,
        });

        const vehicles = await app.inject({ method: 'GET', url: '/vehicles', headers });
        assert.equal(vehicles.statusCode, 200);
        assert.equal(vehicles.json().data.length, 1);
        assert.equal(vehicles.json().data[0].currentOdometer, 12_500);
    } finally {
        await app.close();
    }
});

test('Postgres schema constraints and sync routes support every shared entity type', { skip: !databaseUrl }, async () => {
    const sql = postgres(databaseUrl!, { max: 1 });
    const app = await createPostgresApp();

    try {
        const constraints = await sql<{ conname: string; definition: string }[]>`
            SELECT conname, pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conname IN ('sync_entities_entity_type_check', 'sync_changes_entity_type_check')
            ORDER BY conname
        `;
        const expectedEntityTypes = Object.values(SyncEntity).sort();
        assert.equal(constraints.length, 2);
        for (const constraint of constraints) {
            assert.deepEqual(entityTypesFromConstraint(constraint.definition), expectedEntityTypes);
        }

        const headers = authorizationHeaders(await registerUser(app, 'parity'));
        const vehicle = vehiclePayload('parity-vehicle');
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers, payload: vehicle })).statusCode, 201);
        for (const child of childRequests(vehicle.clientId, 'parity')) {
            assert.equal((await app.inject({ method: 'POST', url: child.route, headers, payload: child.payload })).statusCode, 201);
        }

        const changes = (await app.inject({ method: 'GET', url: '/sync?after=0', headers })).json().data as Array<{ entityType: string }>;
        assert.deepEqual([...new Set(changes.map((change) => change.entityType))].sort(), expectedEntityTypes);
    } finally {
        await app.close();
        await sql.end();
    }
});

test('Postgres keeps every entity, tombstone, and change feed scoped to its authenticated user', { skip: !databaseUrl }, async () => {
    const app = await createPostgresApp();

    try {
        const aHeaders = authorizationHeaders(await registerUser(app, 'isolation-a'));
        const bHeaders = authorizationHeaders(await registerUser(app, 'isolation-b'));
        const sharedClientId = 'vehicle-same-client-id';
        const aVehicle = { ...vehiclePayload(sharedClientId), brand: 'A vehicle' };
        const bVehicle = { ...vehiclePayload(sharedClientId), brand: 'B vehicle' };

        const aCreated = await app.inject({ method: 'POST', url: '/vehicles', headers: aHeaders, payload: aVehicle });
        const bCreated = await app.inject({ method: 'POST', url: '/vehicles', headers: bHeaders, payload: bVehicle });
        assert.equal(aCreated.statusCode, 201);
        assert.equal(bCreated.statusCode, 201);
        assert.notEqual(aCreated.json().data.id, bCreated.json().data.id);

        assert.deepEqual((await app.inject({ method: 'GET', url: '/vehicles', headers: aHeaders })).json().data.map((vehicle: { brand: string }) => vehicle.brand), ['A vehicle']);
        assert.deepEqual((await app.inject({ method: 'GET', url: '/vehicles', headers: bHeaders })).json().data.map((vehicle: { brand: string }) => vehicle.brand), ['B vehicle']);

        const aUpdate = await app.inject({ method: 'POST', url: '/vehicles', headers: aHeaders, payload: { ...aVehicle, currentOdometer: 22_000 } });
        assert.equal(aUpdate.statusCode, 201);
        assert.equal(aUpdate.json().data.id, aCreated.json().data.id);
        assert.equal((await app.inject({ method: 'GET', url: '/vehicles', headers: bHeaders })).json().data[0].currentOdometer, bVehicle.currentOdometer);

        assert.equal((await app.inject({ method: 'DELETE', url: `/vehicles/${sharedClientId}`, headers: aHeaders })).statusCode, 204);
        assert.deepEqual((await app.inject({ method: 'GET', url: '/vehicles', headers: bHeaders })).json().data.map((vehicle: { brand: string }) => vehicle.brand), ['B vehicle']);

        const aParent = vehiclePayload('vehicle-a-parent');
        const bParent = vehiclePayload('vehicle-b-parent');
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers: aHeaders, payload: aParent })).statusCode, 201);
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers: bHeaders, payload: bParent })).statusCode, 201);

        const aChildren = childRequests(aParent.clientId, 'a-owned');
        for (const child of aChildren) {
            assert.equal((await app.inject({ method: 'POST', url: child.route, headers: bHeaders, payload: child.payload })).statusCode, 409);
            assert.equal((await app.inject({ method: 'POST', url: child.route, headers: aHeaders, payload: child.payload })).statusCode, 201);
        }

        const aFeed = (await app.inject({ method: 'GET', url: '/sync?after=0', headers: aHeaders })).json();
        const bFeed = (await app.inject({ method: 'GET', url: '/sync?after=0', headers: bHeaders })).json();
        assert.equal(aFeed.data.some((change: { payload: { clientId: string } }) => change.payload.clientId === bParent.clientId), false);
        assert.equal(bFeed.data.some((change: { payload: { vehicleClientId?: string } }) => change.payload.vehicleClientId === aParent.clientId), false);

        const aCursor = aFeed.nextCursor as number;
        for (const child of aChildren) {
            assert.equal((await app.inject({ method: 'DELETE', url: `${child.route}/${child.payload.clientId}`, headers: bHeaders })).statusCode, 204);
        }

        assert.deepEqual((await app.inject({ method: 'GET', url: `/sync?after=${aCursor}`, headers: aHeaders })).json(), { data: [], nextCursor: aCursor });
        const bAfterDeletes = (await app.inject({ method: 'GET', url: `/sync?after=${bFeed.nextCursor}`, headers: bHeaders })).json();
        assert.deepEqual(
            bAfterDeletes.data.map((change: { entityType: string; operation: string }) => `${change.entityType}:${change.operation}`).sort(),
            aChildren.map((child) => `${child.entityType}:delete`).sort(),
        );

        const aFinalFeed = (await app.inject({ method: 'GET', url: '/sync?after=0', headers: aHeaders })).json().data as Array<{ entityType: string; operation: string; payload: { clientId: string } }>;
        for (const child of aChildren) {
            assert.equal(aFinalFeed.some((change) => change.entityType === child.entityType && change.operation === 'delete' && change.payload.clientId === child.payload.clientId), false);
        }
    } finally {
        await app.close();
    }
});

test('Postgres tombstones a vehicle and every supported child without allowing stale replays', { skip: !databaseUrl }, async () => {
    const app = await createPostgresApp();

    try {
        const headers = authorizationHeaders(await registerUser(app, 'stale-parent'));
        const vehicle = vehiclePayload('vehicle-stale-parent');
        const children = childRequests(vehicle.clientId, 'stale-parent');
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers, payload: vehicle })).statusCode, 201);
        for (const child of children) {
            assert.equal((await app.inject({ method: 'POST', url: child.route, headers, payload: child.payload })).statusCode, 201);
        }

        assert.equal((await app.inject({ method: 'DELETE', url: `/vehicles/${vehicle.clientId}`, headers })).statusCode, 204);
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers, payload: vehicle })).statusCode, 204);
        for (const child of children) {
            assert.equal((await app.inject({ method: 'POST', url: child.route, headers, payload: child.payload })).statusCode, 204);
        }

        const changes = (await app.inject({ method: 'GET', url: '/sync?after=0', headers })).json().data as Array<{ entityType: string; operation: string; payload: { clientId: string } }>;
        assert.equal(changes.some((change) => change.entityType === SyncEntity.Vehicle && change.operation === 'delete' && change.payload.clientId === vehicle.clientId), true);
        for (const child of children) {
            assert.equal(changes.some((change) => change.entityType === child.entityType && change.operation === 'delete' && change.payload.clientId === child.payload.clientId), true);
        }
    } finally {
        await app.close();
    }
});

test('Postgres normalizes a concurrent duplicate registration to the duplicate-email response', { skip: !databaseUrl }, async () => {
    const app = await createPostgresApp();
    const email = `duplicate-${randomUUID()}@drivecost.test`;

    try {
        const responses = await Promise.all([
            app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'correct-horse-battery-staple' } }),
            app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'correct-horse-battery-staple' } }),
        ]);
        assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 409]);
        assert.equal(responses.find((response) => response.statusCode === 409)!.json().type, 'https://drivecost.app/problems/email-already-registered');
    } finally {
        await app.close();
    }
});

test('Postgres migrates and atomically rotates independent server-side refresh sessions', { skip: !databaseUrl }, async () => {
    const sql = postgres(databaseUrl!, { max: 1 });
    const app = await createPostgresApp();
    const email = `postgres-session-${randomUUID()}@drivecost.test`;
    try {
        const columns = await sql<{ column_name: string }[]>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'auth_sessions'
          ORDER BY column_name
        `;
        assert.deepEqual(columns.map((column) => column.column_name), [
            'created_at', 'expires_at', 'id', 'last_used_at', 'refresh_token_hash', 'revoked_at', 'user_id',
        ]);

        const registration = await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'correct-horse-battery-staple' } });
        assert.equal(registration.statusCode, 201);
        const deviceA = registration.json() as SessionBody;
        const deviceBLogin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'correct-horse-battery-staple' } });
        assert.equal(deviceBLogin.statusCode, 200);
        const deviceB = deviceBLogin.json() as SessionBody;
        const deviceASessionId = (app.jwt.decode(deviceA.accessToken) as { sid: string }).sid;
        const [storedSession] = await sql<{ refresh_token_hash: string }[]>`
          SELECT refresh_token_hash FROM auth_sessions WHERE id = ${deviceASessionId}
        `;
        assert.match(storedSession.refresh_token_hash, /^[a-f0-9]{64}$/);
        assert.notEqual(storedSession.refresh_token_hash, deviceA.refreshToken);

        const concurrentRotation = await Promise.all([
            app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: deviceA.refreshToken } }),
            app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: deviceA.refreshToken } }),
        ]);
        assert.deepEqual(concurrentRotation.map((response) => response.statusCode).sort(), [200, 401]);
        const rotatedA = concurrentRotation.find((response) => response.statusCode === 200)!.json() as SessionBody;
        assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: rotatedA.refreshToken } })).statusCode, 204);
        assert.equal((await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: rotatedA.refreshToken } })).statusCode, 401);
        assert.equal((await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: deviceB.refreshToken } })).statusCode, 200);

        const guestResponse = await app.inject({ method: 'POST', url: '/auth/guest' });
        assert.equal(guestResponse.statusCode, 201);
        const guest = guestResponse.json() as SessionBody;
        const vehicle = vehiclePayload(`postgres-guest-${randomUUID()}`);
        assert.equal((await app.inject({ method: 'POST', url: '/vehicles', headers: authorizationHeaders(guest.accessToken), payload: vehicle })).statusCode, 201);
        const upgrade = await app.inject({
            method: 'POST',
            url: '/auth/upgrade',
            headers: authorizationHeaders(guest.accessToken),
            payload: { email: `postgres-upgrade-${randomUUID()}@drivecost.test`, password: 'correct-horse-battery-staple' },
        });
        assert.equal(upgrade.statusCode, 200);
        const upgraded = upgrade.json() as SessionBody;
        assert.equal(upgraded.user.id, guest.user.id);
        assert.equal((await app.inject({ method: 'GET', url: '/vehicles', headers: authorizationHeaders(upgraded.accessToken) })).json().data[0].clientId, vehicle.clientId);
    } finally {
        await app.close();
        await sql.end();
    }
});

async function createPostgresApp() {
    return createApp({ jwtSecret: testSecret, logger: false, repository: new PostgresRepository(databaseUrl!) });
}

async function registerUser(app: Awaited<ReturnType<typeof createPostgresApp>>, prefix: string): Promise<string> {
    const registration = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: `${prefix}-${randomUUID()}@drivecost.test`, password: 'correct-horse-battery-staple' },
    });
    assert.equal(registration.statusCode, 201);
    return registration.json().accessToken as string;
}

function authorizationHeaders(accessToken: string) {
    return { authorization: `Bearer ${accessToken}` };
}

function vehiclePayload(clientId: string) {
    return { clientId, brand: 'Toyota', model: 'Corolla', year: 2022, ownershipStartMileage: 10_000, trackingStartMileage: 12_000, currentOdometer: 20_000 };
}

function childRequests(vehicleClientId: string, prefix: string) {
    return [
        { entityType: SyncEntity.FuelEntry, route: '/fuel-entries', payload: { clientId: `${prefix}-fuel`, vehicleClientId, date: '2026-09-13T08:00:00.000Z', liters: 40, price: 70, odometer: 20_100, fillStatus: 'full' } },
        { entityType: SyncEntity.ChargingEntry, route: '/charging-entries', payload: { clientId: `${prefix}-charging`, vehicleClientId, date: '2026-09-13T09:00:00.000Z', kWh: 24, price: 12, odometer: 20_200 } },
        { entityType: SyncEntity.MaintenanceEntry, route: '/maintenance-entries', payload: { clientId: `${prefix}-maintenance`, vehicleClientId, date: '2026-09-13T10:00:00.000Z', type: 'Service', description: 'Oil change', cost: 100, odometer: 20_300 } },
        { entityType: SyncEntity.ExpenseEntry, route: '/ownership-expenses', payload: { clientId: `${prefix}-expense`, vehicleClientId, date: '2026-09-13T11:00:00.000Z', category: 'insurance', totalPaid: 480, odometer: 20_400 } },
        { entityType: SyncEntity.RecurringExpense, route: '/recurring-expenses', payload: { clientId: `${prefix}-recurring`, vehicleClientId, category: 'insurance', amount: 480, periodMonths: 12, startDate: '2026-09-13T00:00:00.000Z', active: true } },
    ];
}

function entityTypesFromConstraint(definition: string): string[] {
    return [...definition.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
}

interface SessionBody {
    accessToken: string;
    refreshToken: string;
    user: { id: string; mode: 'guest' | 'registered' };
}
