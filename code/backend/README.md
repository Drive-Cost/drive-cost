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
- signed JWT guest sessions and email/password account registration
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
- add refresh-token rotation, account recovery, and rate limiting
- add pull sync and conflict resolution
- add subscription entitlements
- add curated vehicle catalog and domain data

## Notes

Do not move core product learning into the backend too early.

The backend should support the app, not slow it down. Keep the mobile app
usable offline even after backend introduction.
