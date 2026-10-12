import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { SessionResponse } from '@drivecost/contracts';
import { SyncEntity } from '@drivecost/contracts';
import { createApp } from '../../../../src/app';
import type { DriveCostRepository } from '../../../../src/platform/persistence/repository';
import { createSession } from '../../../../src/modules/auth/sessions';

export const jwtSecret = 'test-secret-that-is-at-least-thirty-two-characters';
export const password = 'correct-horse-battery-staple';
export const secret = () => randomBytes(32).toString('base64url');
export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
export type App = Awaited<ReturnType<typeof createApp>>;
export async function register(app: App, email = `${randomUUID()}@drivecost.test`): Promise<SessionResponse> {
    const response = await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password } });
    assert.equal(response.statusCode, 201);
    return response.json();
}
export function deleteRequest(
    app: App,
    session: SessionResponse,
    operationSecret = secret(),
    confirmation = { password }
) {
    return app.inject({
        method: 'POST',
        url: '/account/deletion',
        headers: bearer(session.accessToken),
        payload: { operationSecret, ...confirmation },
    });
}
export function statusRequest(app: App, operationSecret: string) {
    return app.inject({ method: 'POST', url: '/account/deletion/status', payload: { operationSecret } });
}
export async function seed(repository: DriveCostRepository, userId: string) {
    const clientId = `vehicle-${randomUUID()}`;
    await repository.upsertEntity(userId, SyncEntity.Vehicle, { clientId, brand: 'Toyota', model: 'Yaris' });
    for (const entityType of Object.values(SyncEntity).filter(type => type !== SyncEntity.Vehicle)) {
        await repository.upsertEntity(userId, entityType, {
            clientId: `${clientId}-${entityType}`,
            vehicleClientId: clientId,
            price: 1,
        });
    }
    await repository.deleteVehicle(userId, clientId);
    await repository.upsertEntity(userId, SyncEntity.Vehicle, { clientId: `active-${clientId}`, brand: 'Honda' });
}
export function lifecycleTests(
    label: string,
    makeRepository: () => DriveCostRepository,
    inspectDeletion: (id: string) => Promise<void>,
    skip = false
) {
    test(
        `${label}: deletion purges all entities, tombstones, feed, sessions and credentials; receipts survive restart`,
        { skip },
        async () => {
            const repository = makeRepository();
            let app = await createApp({ jwtSecret, logger: false, repository });
            try {
                const email = `delete-${randomUUID()}@drivecost.test`;
                const a = await register(app, email);
                const b = await register(app);
                const otherDevice = (
                    await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })
                ).json<SessionResponse>();
                await repository.createAuthSession(createSession(a.user.id).session);
                await seed(repository, a.user.id);
                await seed(repository, b.user.id);
                const beforeB = await repository.listChanges(b.user.id, 0, 1000);
                const beforeBEntities = await Promise.all(
                    Object.values(SyncEntity).map(type => repository.listEntities(b.user.id, type))
                );
                assert.equal(
                    new Set((await repository.listChanges(a.user.id, 0, 1000)).map(change => change.entityType)).size,
                    6
                );
                const operationSecret = secret();
                // Discard the deletion response: the client must recover with the capability alone.
                const response = await deleteRequest(app, a, operationSecret);
                assert.equal(response.statusCode, 200);
                assert.equal(response.headers['cache-control'], 'no-store');
                const completed = response.json();
                assert.deepEqual(Object.keys(completed).sort(), ['completedAt', 'deletedUserId', 'status']);
                assert.equal(completed.deletedUserId, a.user.id);
                assert.equal(completed.status, 'completed');
                await inspectDeletion(a.user.id);
                assert.deepEqual(await repository.listChanges(b.user.id, 0, 1000), beforeB);
                assert.ok(await repository.findUserById(b.user.id));
                assert.deepEqual(
                    await Promise.all(Object.values(SyncEntity).map(type => repository.listEntities(b.user.id, type))),
                    beforeBEntities
                );
                assert.equal(
                    (
                        await app.inject({
                            method: 'POST',
                            url: '/auth/refresh',
                            payload: { refreshToken: b.refreshToken },
                        })
                    ).statusCode,
                    200
                );
                for (const device of [a, otherDevice]) {
                    for (const url of ['/vehicles', '/sync?after=0']) {
                        const denied = await app.inject({ method: 'GET', url, headers: bearer(device.accessToken) });
                        assert.equal(denied.statusCode, 410);
                        assert.equal(denied.json().type, 'https://drivecost.app/problems/account-unavailable');
                    }
                    assert.equal(
                        (
                            await app.inject({
                                method: 'POST',
                                url: '/auth/refresh',
                                payload: { refreshToken: device.refreshToken },
                            })
                        ).statusCode,
                        401
                    );
                }
                assert.equal((await deleteRequest(app, a, operationSecret)).statusCode, 410);
                assert.equal(
                    (await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })).statusCode,
                    401
                );
                assert.deepEqual((await statusRequest(app, secret())).json(), { status: 'unknown' });
                assert.equal((await deleteRequest(app, b, operationSecret)).statusCode, 409);
                assert.ok(await repository.findUserById(b.user.id));
                const fresh = await register(app, email);
                assert.notEqual(fresh.user.id, a.user.id);
                assert.deepEqual(
                    (
                        await app.inject({ method: 'GET', url: '/sync?after=0', headers: bearer(fresh.accessToken) })
                    ).json().data,
                    []
                );
                assert.equal(
                    (await app.inject({ method: 'GET', url: '/sync?after=0', headers: bearer(a.accessToken) }))
                        .statusCode,
                    410
                );
                await app.close();
                app = await createApp({ jwtSecret, logger: false, repository: makeRepository() });
                assert.deepEqual((await statusRequest(app, operationSecret)).json(), completed);
                assert.deepEqual((await statusRequest(app, operationSecret)).json(), completed);
            } finally {
                await app.close();
            }
        }
    );
    test(
        `${label}: confirmation validates live session, rejects untrusted targeting and preserves ordinary sign-out`,
        { skip },
        async () => {
            const repository = makeRepository();
            const app = await createApp({ jwtSecret, logger: false, repository });
            try {
                const a = await register(app);
                const invalid = await deleteRequest(app, a, secret(), { password: 'an-incorrect-password' });
                assert.equal(invalid.statusCode, 403);
                assert.equal(invalid.json().type, 'https://drivecost.app/problems/deletion-confirmation-failed');
                assert.equal(
                    (
                        await app.inject({
                            method: 'POST',
                            url: '/account/deletion',
                            payload: { operationSecret: secret(), password },
                        })
                    ).statusCode,
                    401
                );
                assert.equal(
                    (
                        await app.inject({
                            method: 'POST',
                            url: '/account/deletion',
                            headers: bearer(a.accessToken),
                            payload: {
                                operationSecret: secret(),
                                password,
                                userId: 'another-user',
                                email: 'another@drivecost.test',
                            },
                        })
                    ).statusCode,
                    400
                );
                // A signed access credential cannot substitute for a missing live session.
                const forged = {
                    ...a,
                    accessToken: app.jwt.sign({ sub: a.user.id, sid: 'missing-session', mode: 'registered' }),
                };
                assert.equal((await deleteRequest(app, forged)).statusCode, 401);
                const expired = createSession(a.user.id, new Date(Date.now() - 31 * 86_400_000));
                await repository.createAuthSession(expired.session);
                const expiredToken = {
                    ...a,
                    accessToken: app.jwt.sign({ sub: a.user.id, sid: expired.session.id, mode: 'registered' }),
                };
                assert.equal((await deleteRequest(app, expiredToken)).statusCode, 401);
                assert.equal((await statusRequest(app, 'invalid-secret')).statusCode, 400);
                await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: a.refreshToken } });
                assert.equal(
                    (await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(a.accessToken) })).statusCode,
                    200
                );
                assert.equal(
                    (
                        await app.inject({
                            method: 'POST',
                            url: '/account/deletion',
                            remoteAddress: '127.0.0.2',
                            headers: bearer(a.accessToken),
                            payload: { operationSecret: secret(), password },
                        })
                    ).statusCode,
                    401
                );
                assert.ok(await repository.findUserById(a.user.id));
            } finally {
                await app.close();
            }
        }
    );
    test(
        `${label}: guests need live refresh possession; persisted registered mode never accepts guest proof`,
        { skip },
        async () => {
            const repository = makeRepository();
            const app = await createApp({ jwtSecret, logger: false, repository });
            try {
                const guest = (await app.inject({ method: 'POST', url: '/auth/guest' })).json<SessionResponse>();
                const another = (await app.inject({ method: 'POST', url: '/auth/guest' })).json<SessionResponse>();
                const guestDelete = (refreshToken: string) =>
                    app.inject({
                        method: 'POST',
                        url: '/account/deletion',
                        headers: bearer(guest.accessToken),
                        payload: { operationSecret: secret(), refreshToken },
                    });
                assert.equal((await guestDelete(another.refreshToken)).statusCode, 403);
                assert.equal((await guestDelete(guest.refreshToken)).statusCode, 200);
                await inspectDeletion(guest.user.id);
                const a = await register(app);
                const sid = (app.jwt.decode(a.accessToken) as { sid: string }).sid;
                const staleMode = app.jwt.sign({ sub: a.user.id, sid, mode: 'guest' });
                assert.equal(
                    (
                        await app.inject({
                            method: 'POST',
                            url: '/account/deletion',
                            headers: bearer(staleMode),
                            payload: { operationSecret: secret(), refreshToken: a.refreshToken },
                        })
                    ).statusCode,
                    403
                );
                assert.ok(await repository.findUserById(a.user.id));
                const upgradeGuest = (await app.inject({ method: 'POST', url: '/auth/guest' })).json<SessionResponse>();
                const upgraded = await app.inject({
                    method: 'POST',
                    url: '/auth/upgrade',
                    headers: bearer(upgradeGuest.accessToken),
                    payload: { email: `upgrade-${randomUUID()}@drivecost.test`, password },
                });
                assert.equal(upgraded.statusCode, 200);
                assert.equal(
                    (
                        await app.inject({
                            method: 'POST',
                            url: '/account/deletion',
                            headers: bearer(upgradeGuest.accessToken),
                            payload: { operationSecret: secret(), refreshToken: upgradeGuest.refreshToken },
                        })
                    ).statusCode,
                    401
                );
            } finally {
                await app.close();
            }
        }
    );
}
