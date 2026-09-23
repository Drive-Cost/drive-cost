# DriveCost Backend

This folder is the backend module for DriveCost.

It exists because the product direction is now clear: the app will eventually
need sync, accounts, backup, subscriptions, and curated vehicle domain data.

## Why A Backend

The local-first mobile app is still the right MVP foundation.

The backend becomes responsible for the parts that do not belong only on-device:

- authentication and accounts
- sync across devices
- backup and restore
- subscription and billing state
- centralized vehicle/domain data
- future analytics and reporting APIs

## Suggested Responsibilities

The backend should own:

- users
- vehicles synced to accounts
- normalized fuel and maintenance records
- subscription entitlements
- domain reference data
- sync conflict resolution

The mobile app should keep owning:

- responsive offline UX
- local caching
- immediate entry creation
- local calculations when possible

## Suggested First Backend Milestones

1. Auth and user accounts
2. Vehicle and entry sync
3. Backup and restore
4. Subscription entitlements
5. Curated vehicle metadata and domain data

## Recommended Shape

A practical first structure could be:

- `src/modules/auth`
- `src/modules/users`
- `src/modules/vehicles`
- `src/modules/entries`
- `src/modules/subscriptions`
- `src/modules/catalog`

## Current State

The Fastify module now has a secure development boundary:

- file-backed JSON persistence in `data/db.json` for local development only
- short-lived JWT access tokens and rotating, revocable server-side sessions
- password hashes derived with Node's `scrypt`
- authenticated, user-scoped vehicle and entry sync
- JSON Schema validation before every sync write
- Fastify integration tests for health and protected vehicle sync

The running API selects its persistence adapter through `PERSISTENCE_DRIVER`.
Use `file` for local development with the JSON adapter, or `postgres` with a
migrated `DATABASE_URL` for the production storage path.

Run it with:

```bash
cd code/contracts
npm install
npm run build
cd ../backend
npm install
cp .env.example .env
# Set JWT_SECRET to a unique 32+ character value.
npm run dev
```

## Local Postgres

Start a local Postgres service and apply the forward-only migrations:

```bash
cd code/backend
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
```

Set `PERSISTENCE_DRIVER=postgres` before starting the API to use this database.

The compose file requires `POSTGRES_PASSWORD`; do not use Postgres trust
authentication outside throwaway experiments.

## Authentication sessions

DriveCost access tokens are HS256 JWTs with a 15-minute lifetime. They use the
issuer `https://api.drivecost.app` and audience `drivecost-mobile`; protected
routes verify the algorithm, issuer, and audience. Tokens contain only the
user ID, account mode, and session ID.

Register, login, guest creation, and guest upgrade return an access token, an
opaque refresh token, an access-token expiry timestamp, and a safe user
representation. Refresh tokens use `<session-id>.<random-secret>`; only a
SHA-256 hash of the random secret is stored. Refresh rotates the secret
atomically and extends the inactivity expiry by 30 days. Multiple sessions per
user are supported, so revoking one device does not affect another.

`POST /auth/logout` accepts a refresh token and is idempotent. It revokes only
that refresh session, not the account or synchronized data. An already-issued
access token can remain usable until its 15-minute expiry. The same short
window applies to a guest access token issued before upgrade; it still refers
to the same user and cannot cross ownership boundaries. Expired/revoked rows
are ignored by session operations; physical cleanup can be added later.

Register, login, and guest creation are limited in-memory to 10 attempts per
minute per source IP. Refresh allows 60 per minute per source IP to tolerate
normal mobile recovery. This is a single-instance beta control, not a
distributed rate-limit system.

`JWT_SECRET` is backend-only and must be at least 32 characters. The server
refuses startup without it. Never put this secret, passwords, access tokens,
refresh tokens, or refresh-token hashes in mobile configuration or logs.

## Postgres integration tests

The production adapter is tested against a fresh, isolated local Postgres
service. This test path resets only the `drivecost-postgres-test` Docker volume
and uses port `55432`; it does not use a developer's configured database.

```bash
cd code/backend
npm run test:postgres:local
```

The command starts the test service, applies every forward-only migration, and
runs the Postgres integration suite with:

```text
DATABASE_URL=postgres://drivecost_test:drivecost-test-password@localhost:55432/drivecost_test
```

CI can instead supply any isolated `DATABASE_URL` and run `npm run
test:postgres`. Schema-parity tests compare the `sync_entities` and
`sync_changes` constraints with the shared contract's complete entity set:
vehicle, fuel entry, charging entry, maintenance entry, ownership expense
(`expense_entry`), and recurring expense.

The same suite applies migration `005_auth_sessions` and verifies Postgres
session hashing, atomic refresh rotation, independent device sessions,
revocation, and guest-upgrade ownership preservation.

## Backend Structure

- `src/server.ts`: Fastify server bootstrap
- `src/app.ts`: app assembly
- `src/config`: runtime config
- `src/lib`: development persistence helpers
- `src/modules/auth`: guest sessions, registration, login, and password hashing
- `src/modules/vehicles`: synced vehicle endpoints
- `src/modules/entries`: synced fuel and maintenance endpoints
- `src/modules/health`: health and service status

## Planned Production Direction

This structure is designed so the next upgrades can happen without changing the
mobile sync contract:

- replace file JSON persistence with Postgres
- add account recovery and email verification
- add pull sync and conflict resolution
- add subscription entitlements
- add curated vehicle catalog and domain data

## Notes

Do not move core product learning into the backend too early.

The backend should support the app, not slow it down. Keep the mobile app
usable offline even after backend introduction.
