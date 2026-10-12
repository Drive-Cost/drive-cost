import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createApp } from '../../../src/app';
import { readDatabase, writeDatabase } from '../../../src/lib/fileDatabase';
import { FileRepository } from '../../../src/platform/persistence/fileRepository';
import { createSession } from '../../../src/modules/auth/sessions';
import { hashDeletionSecret } from '../../../src/modules/auth/accountDeletion';
import { SyncEntity, decodeAccountDeletionStatus } from '@drivecost/contracts';
import {
    lifecycleTests,
    jwtSecret,
    register,
    deleteRequest,
    statusRequest,
    secret,
    password,
    bearer,
} from './helpers/deletion';

lifecycleTests(
    'File',
    () => new FileRepository(),
    async id => {
        const database = readDatabase();
        assert.equal(
            database.users.some(user => user.id === id),
            false
        );
        for (const collection of [
            database.authSessions,
            database.syncChanges,
            database.vehicles,
            database.fuelEntries,
            database.chargingEntries,
            database.maintenanceEntries,
            database.expenseEntries,
            database.recurringExpenses,
        ]) {
            assert.equal(
                collection.some(record => record.userId === id),
                false
            );
        }
    }
);

test('File: legacy feed migration remains monotonic after purging the highest cursors', async () => {
    const repository = new FileRepository();
    const app = await createApp({ jwtSecret, logger: false, repository });
    try {
        const a = await register(app);
        const b = await register(app);
        await repository.upsertEntity(b.user.id, SyncEntity.Vehicle, { clientId: secret() });
        const bCursor = (await repository.listChanges(b.user.id, 0, 1000)).at(-1)!.sequence;
        await repository.upsertEntity(a.user.id, SyncEntity.Vehicle, { clientId: secret() });
        const highest = readDatabase().syncChanges.at(-1)!.sequence;
        // Simulate a pre-migration snapshot that never persisted a counter.
        const legacy = readDatabase();
        const { nextChangeSequence: _counter, deletionReceipts: _receipts, ...old } = legacy;
        fs.writeFileSync(`${process.env.DRIVECOST_DATA_DIR}/db.json`, JSON.stringify(old));
        assert.equal((await deleteRequest(app, a)).statusCode, 200);
        await repository.upsertEntity(b.user.id, SyncEntity.Vehicle, { clientId: secret() });
        const changes = await repository.listChanges(b.user.id, bCursor, 1000);
        assert.equal(changes.length, 1);
        assert.ok(changes[0].sequence > highest);
    } finally {
        await app.close();
    }
});

test('File: pre-rename failure rolls back; post-rename failure recovers from the committed receipt', async t => {
    const repository = new FileRepository();
    const app = await createApp({ jwtSecret, logger: false, repository });
    try {
        const a = await register(app);
        const before = readDatabase();
        const operationSecret = secret();
        const rename = t.mock.method(fs, 'renameSync', () => {
            throw new Error('injected rename failure');
        });
        assert.equal((await deleteRequest(app, a, operationSecret)).statusCode, 500);
        rename.mock.restore();
        assert.deepEqual(readDatabase(), before);
        assert.deepEqual((await statusRequest(app, operationSecret)).json(), { status: 'unknown' });
        assert.equal(
            fs.readdirSync(process.env.DRIVECOST_DATA_DIR!).some(name => name.endsWith('.tmp')),
            false
        );
        const original = fs.fsyncSync;
        let calls = 0;
        const sync = t.mock.method(fs, 'fsyncSync', (fd: number) => {
            calls += 1;
            if (calls === 2) throw new Error('injected directory sync failure');
            return original(fd);
        });
        assert.equal((await deleteRequest(app, a, operationSecret)).statusCode, 500);
        sync.mock.restore();
        const status = (await statusRequest(app, operationSecret)).json();
        assert.equal(status.status, 'completed');
        assert.equal(status.deletedUserId, a.user.id);
        assert.equal(await repository.findUserById(a.user.id), null);
    } finally {
        await app.close();
    }
});

test('File: async confirmation cannot erase an upgraded identity or newly revoked session', async () => {
    const repository = new FileRepository();
    const app = await createApp({ jwtSecret, logger: false, repository });
    try {
        const a = await register(app);
        const sessionId = (app.jwt.decode(a.accessToken) as { sid: string }).sid;
        await assert.rejects(
            repository.deleteAccount(a.user.id, sessionId, hashDeletionSecret(secret()), async () => {
                await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: a.refreshToken } });
            }),
            /Authentication required/
        );
        const guest = (await app.inject({ method: 'POST', url: '/auth/guest' })).json();
        const guestSid = (app.jwt.decode(guest.accessToken) as { sid: string }).sid;
        await assert.rejects(
            repository.deleteAccount(guest.user.id, guestSid, hashDeletionSecret(secret()), async () => {
                const db = readDatabase();
                const user = db.users.find(user => user.id === guest.user.id)!;
                user.mode = 'registered';
                user.email = 'upgraded-within-confirmation@drivecost.test';
                user.passwordHash = 'updated-hash';
                writeDatabase(db);
            }),
            /could not be confirmed/
        );
        assert.equal((await repository.findUserById(guest.user.id))?.mode, 'registered');
        assert.equal(
            readDatabase().deletionReceipts.some(receipt => receipt.deletedUserId === guest.user.id),
            false
        );
    } finally {
        await app.close();
    }
});

test('File: deleted users cannot write or create sessions at the persistence boundary; expired receipts are purged', async () => {
    const repository = new FileRepository();
    const app = await createApp({ jwtSecret, logger: false, repository });
    try {
        const a = await register(app);
        const operationSecret = secret();
        assert.equal((await deleteRequest(app, a, operationSecret)).statusCode, 200);
        for (const operation of [
            () => repository.upsertEntity(a.user.id, SyncEntity.Vehicle, { clientId: secret() }),
            () => repository.deleteEntity(a.user.id, SyncEntity.FuelEntry, secret()),
            () => repository.deleteVehicle(a.user.id, secret()),
            () => repository.createAuthSession(createSession(a.user.id).session),
        ])
            await assert.rejects(operation(), /no longer available/);
        const database = readDatabase();
        const receipt = database.deletionReceipts.find(
            receipt => receipt.secretHash === hashDeletionSecret(operationSecret)
        )!;
        assert.deepEqual(Object.keys(receipt).sort(), ['completedAt', 'deletedUserId', 'expiresAt', 'secretHash']);
        assert.equal(JSON.stringify(receipt).includes(operationSecret), false);
        receipt.expiresAt = new Date(Date.now() - 1000).toISOString();
        writeDatabase(database);
        assert.deepEqual((await statusRequest(app, operationSecret)).json(), { status: 'unknown' });
        assert.equal(
            readDatabase().deletionReceipts.some(receipt => receipt.secretHash === hashDeletionSecret(operationSecret)),
            false
        );
    } finally {
        await app.close();
    }
});

test('Deletion rate limits and logs never reveal confirmations or capability secrets', async t => {
    const logs: string[] = [];
    const repository = new FileRepository();
    const app = await createApp({
        jwtSecret,
        repository,
        logger: {
            stream: {
                write: (chunk: string) => {
                    logs.push(chunk);
                },
            },
        },
    });
    try {
        const a = await register(app);
        const operationSecret = secret();
        for (let attempt = 0; attempt < 5; attempt += 1) {
            assert.equal(
                (await deleteRequest(app, a, operationSecret, { password: 'an-incorrect-password' })).statusCode,
                403
            );
        }
        assert.equal(
            (
                await app.inject({
                    method: 'POST',
                    url: '/account/deletion',
                    remoteAddress: '127.0.0.2',
                    headers: bearer(a.accessToken),
                    payload: { operationSecret, password },
                })
            ).statusCode,
            429
        );
        for (let attempt = 0; attempt < 30; attempt += 1)
            assert.equal((await statusRequest(app, operationSecret)).statusCode, 200);
        assert.equal((await statusRequest(app, operationSecret)).statusCode, 429);
        const failure = t.mock.method(repository, 'findUserById', async () => {
            throw new Error(`${password} ${a.accessToken} ${a.refreshToken} ${operationSecret}`);
        });
        assert.equal(
            (await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(a.accessToken) })).statusCode,
            500
        );
        failure.mock.restore();
        const logged = logs.join('');
        for (const value of [password, 'an-incorrect-password', a.accessToken, a.refreshToken, operationSecret])
            assert.equal(logged.includes(value), false);
        assert.match(logged, /account\/deletion/);
        assert.equal(
            (await app.inject({ method: 'GET', url: '/vehicles', headers: bearer(a.accessToken) })).statusCode,
            200
        );
    } finally {
        await app.close();
    }
});

test('Deletion contract never treats missing or malformed evidence as completion', () => {
    assert.deepEqual(decodeAccountDeletionStatus({ status: 'unknown' }), { status: 'unknown' });
    const completed = { status: 'completed', deletedUserId: 'user-a', completedAt: '2026-10-12T00:00:00.000Z' };
    assert.deepEqual(decodeAccountDeletionStatus(completed), completed);
    for (const invalid of [
        null,
        {},
        { status: 'deleted' },
        { status: 'unknown', deletedUserId: 'user-a' },
        { ...completed, deletedUserId: '' },
        { ...completed, completedAt: 'invalid' },
        { status: 'completed' },
    ]) {
        assert.throws(() => decodeAccountDeletionStatus(invalid));
    }
});
