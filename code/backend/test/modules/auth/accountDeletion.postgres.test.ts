import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import postgres from 'postgres';
import { createApp } from '../../../src/app';
import { PostgresRepository } from '../../../src/platform/persistence/postgresRepository';
import { createSession, parseRefreshCredential } from '../../../src/modules/auth/sessions';
import { hashDeletionSecret } from '../../../src/modules/auth/accountDeletion';
import { SyncEntity } from '@drivecost/contracts';
import {
    lifecycleTests,
    jwtSecret,
    register,
    deleteRequest,
    statusRequest,
    secret,
    password,
    seed,
} from './helpers/deletion';

const databaseUrl = process.env.DATABASE_URL;
const makeRepository = () => new PostgresRepository(databaseUrl!);
lifecycleTests(
    'Postgres',
    makeRepository,
    async id => {
        const sql = postgres(databaseUrl!, { max: 1 });
        try {
            for (const table of ['users', 'sync_entities', 'sync_changes', 'auth_sessions']) {
                const column = table === 'users' ? 'id' : 'user_id';
                const rows = await sql`SELECT * FROM ${sql(table)} WHERE ${sql(column)} = ${id}`;
                assert.equal(rows.length, 0, `${table} retains deleted account data`);
            }
        } finally {
            await sql.end();
        }
    },
    !databaseUrl
);

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => {
        resolve = done;
    });
    return { promise, resolve };
}
async function waitForLocks(sql: postgres.Sql, count: number) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const [row] = await sql<
            { count: number }[]
        >`SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
        if (row.count >= count) return;
        await setTimeout(10);
    }
    assert.fail(`Expected ${count} competing database operations to wait on the account lock`);
}

test(
    'Postgres: deletion blocks concurrent writes, session creation, login, refresh and upgrade, then denies recreation',
    { skip: !databaseUrl },
    async () => {
        const repository = makeRepository();
        const sql = postgres(databaseUrl!, { max: 1 });
        const app = await createApp({ jwtSecret, logger: false, repository });
        const entered = deferred();
        const release = deferred();
        try {
            const a = await register(app);
            const sid = (app.jwt.decode(a.accessToken) as { sid: string }).sid;
            const deletion = repository.deleteAccount(a.user.id, sid, hashDeletionSecret(secret()), async () => {
                entered.resolve();
                await release.promise;
            });
            await entered.promise;
            const current = parseRefreshCredential(a.refreshToken)!;
            const operations = [
                repository.upsertEntity(a.user.id, SyncEntity.Vehicle, { clientId: secret() }),
                repository.deleteEntity(a.user.id, SyncEntity.FuelEntry, secret()),
                repository.deleteVehicle(a.user.id, secret()),
                repository.createAuthSession(createSession(a.user.id).session),
                repository.rotateAuthSession(
                    sid,
                    current.refreshTokenHash,
                    'next-hash',
                    new Date().toISOString(),
                    new Date(Date.now() + 86400000).toISOString()
                ),
                repository.upgradeGuestUserWithSession(
                    a.user.id,
                    sid,
                    'race-upgrade@drivecost.test',
                    'new-hash',
                    createSession(a.user.id).session
                ),
                app.inject({ method: 'POST', url: '/auth/login', payload: { email: a.user.email!, password } }),
            ];
            const settled = Promise.allSettled(operations);
            await waitForLocks(sql, operations.length);
            release.resolve();
            await deletion;
            const results = await settled;
            for (const result of results.slice(0, 4)) {
                assert.equal(result.status, 'rejected');
                if (result.status === 'rejected') assert.equal(result.reason.definition.status, 410);
            }
            for (const result of results.slice(4, 6)) {
                assert.equal(result.status, 'fulfilled');
                if (result.status === 'fulfilled') assert.equal(result.value, null);
            }
            const login = results[6];
            assert.equal(login.status, 'fulfilled');
            if (login.status === 'fulfilled') assert.equal((login.value as { statusCode: number }).statusCode, 410);
            for (const table of ['sync_entities', 'sync_changes', 'auth_sessions']) {
                assert.equal((await sql`SELECT * FROM ${sql(table)} WHERE user_id = ${a.user.id}`).length, 0);
            }
        } finally {
            release.resolve();
            await app.close();
            await sql.end();
        }
    }
);

test(
    'Postgres: deletion waits for an earlier writer/session commit and purges its results',
    { skip: !databaseUrl },
    async () => {
        const repository = makeRepository();
        const sql = postgres(databaseUrl!, { max: 2 });
        const app = await createApp({ jwtSecret, logger: false, repository });
        const entered = deferred();
        const release = deferred();
        try {
            const a = await register(app);
            const writer = sql.begin(async transaction => {
                await transaction`SELECT id FROM users WHERE id = ${a.user.id} FOR KEY SHARE`;
                await transaction`INSERT INTO sync_entities (id, user_id, entity_type, client_id, payload)
                VALUES (${secret()}, ${a.user.id}, 'vehicle', ${secret()}, ${transaction.json({ brand: 'Earlier write' })})`;
                const session = createSession(a.user.id).session;
                await transaction`INSERT INTO auth_sessions (id,user_id,refresh_token_hash,created_at,last_used_at,expires_at)
                VALUES (${session.id},${a.user.id},${session.refreshTokenHash},${session.createdAt},${session.lastUsedAt},${session.expiresAt})`;
                entered.resolve();
                await release.promise;
            });
            await entered.promise;
            const deletion = deleteRequest(app, a);
            await waitForLocks(sql, 1);
            release.resolve();
            await writer;
            assert.equal((await deletion).statusCode, 200);
            assert.equal((await sql`SELECT * FROM sync_entities WHERE user_id = ${a.user.id}`).length, 0);
            assert.equal((await sql`SELECT * FROM auth_sessions WHERE user_id = ${a.user.id}`).length, 0);
        } finally {
            release.resolve();
            await app.close();
            await sql.end();
        }
    }
);

test(
    'Postgres: transaction failure rolls back account, cascades and receipt and permits a safe retry',
    { skip: !databaseUrl },
    async () => {
        const repository = makeRepository();
        const sql = postgres(databaseUrl!, { max: 1 });
        const app = await createApp({ jwtSecret, logger: false, repository });
        try {
            const a = await register(app);
            await seed(repository, a.user.id);
            const before = await repository.listChanges(a.user.id, 0, 1000);
            const operationSecret = secret();
            await sql.unsafe(
                `CREATE FUNCTION dc_test_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected delete failure'; END $$`
            );
            await sql.unsafe(
                'CREATE TRIGGER dc_test_fail_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION dc_test_fail_delete()'
            );
            assert.equal((await deleteRequest(app, a, operationSecret)).statusCode, 500);
            assert.ok(await repository.findUserById(a.user.id));
            assert.deepEqual(await repository.listChanges(a.user.id, 0, 1000), before);
            assert.equal((await sql`SELECT * FROM auth_sessions WHERE user_id = ${a.user.id}`).length, 1);
            assert.deepEqual((await statusRequest(app, operationSecret)).json(), { status: 'unknown' });
            await sql.unsafe('DROP TRIGGER dc_test_fail_delete ON users');
            await sql.unsafe('DROP FUNCTION dc_test_fail_delete()');
            assert.equal((await deleteRequest(app, a, operationSecret)).statusCode, 200);
        } finally {
            await sql.unsafe('DROP TRIGGER IF EXISTS dc_test_fail_delete ON users');
            await sql.unsafe('DROP FUNCTION IF EXISTS dc_test_fail_delete()');
            await app.close();
            await sql.end();
        }
    }
);

test(
    'Postgres: receipt migration stores only recovery metadata, enforces collision isolation and purges expiry',
    { skip: !databaseUrl },
    async () => {
        const sql = postgres(databaseUrl!, { max: 1 });
        const repository = makeRepository();
        const app = await createApp({ jwtSecret, logger: false, repository });
        try {
            const columns = await sql<
                { column_name: string }[]
            >`SELECT column_name FROM information_schema.columns WHERE table_name = 'account_deletion_receipts' ORDER BY column_name`;
            assert.deepEqual(
                columns.map(column => column.column_name),
                ['completed_at', 'deleted_user_id', 'expires_at', 'secret_hash']
            );
            assert.equal(
                (
                    await sql`SELECT * FROM pg_constraint WHERE conrelid = 'account_deletion_receipts'::regclass AND contype = 'f'`
                ).length,
                0
            );
            const a = await register(app);
            const b = await register(app);
            const operationSecret = secret();
            const results = await Promise.all([
                deleteRequest(app, a, operationSecret),
                deleteRequest(app, b, operationSecret),
            ]);
            assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 409]);
            const winner = results.find(result => result.statusCode === 200)!.json().deletedUserId;
            assert.ok(await repository.findUserById(winner === a.user.id ? b.user.id : a.user.id));
            const [stored] =
                await sql`SELECT * FROM account_deletion_receipts WHERE secret_hash = ${hashDeletionSecret(operationSecret)}`;
            assert.equal(stored.secret_hash, hashDeletionSecret(operationSecret));
            assert.equal(JSON.stringify(stored).includes(operationSecret), false);
            await sql`UPDATE account_deletion_receipts SET completed_at = now() - interval '32 days', expires_at = now() - interval '2 days' WHERE secret_hash = ${hashDeletionSecret(operationSecret)}`;
            assert.deepEqual((await statusRequest(app, operationSecret)).json(), { status: 'unknown' });
            assert.equal(
                (
                    await sql`SELECT * FROM account_deletion_receipts WHERE secret_hash = ${hashDeletionSecret(operationSecret)}`
                ).length,
                0
            );
        } finally {
            await app.close();
            await sql.end();
        }
    }
);

test(
    'Postgres: refresh cannot renew a session that expires while it waits for the account lock',
    { skip: !databaseUrl },
    async () => {
        const repository = makeRepository();
        const sql = postgres(databaseUrl!, { max: 2 });
        const app = await createApp({ jwtSecret, logger: false, repository });
        const entered = deferred();
        const release = deferred();
        try {
            const a = await register(app);
            const sid = (app.jwt.decode(a.accessToken) as { sid: string }).sid;
            const holder = sql.begin(async transaction => {
                await transaction`SELECT id FROM users WHERE id = ${a.user.id} FOR UPDATE`;
                entered.resolve();
                await release.promise;
                await transaction`UPDATE auth_sessions SET expires_at = clock_timestamp() WHERE id = ${sid}`;
            });
            await entered.promise;
            const refresh = app.inject({
                method: 'POST',
                url: '/auth/refresh',
                payload: { refreshToken: a.refreshToken },
            });
            await waitForLocks(sql, 1);
            release.resolve();
            await holder;
            assert.equal((await refresh).statusCode, 401);
        } finally {
            release.resolve();
            await app.close();
            await sql.end();
        }
    }
);
