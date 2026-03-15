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

The backend now has two layers:

- a new TypeScript + Fastify structure for the real backend direction
- a legacy Node HTTP server kept as a working fallback

The current implementation is still intentionally minimal:

- file-backed JSON persistence in `data/db.json`
- health endpoint
- guest auth placeholder
- vehicle sync endpoint
- fuel entry sync endpoint
- maintenance entry sync endpoint

Run it with:

```bash
cd code/backend
npm install
npm run dev
```

Fallback if dependencies are not installed yet:

```bash
cd code/backend
npm run start:legacy
```

## Backend Structure

- `src/server.ts`: Fastify server bootstrap
- `src/app.ts`: app assembly
- `src/config`: runtime config
- `src/lib`: persistence helpers
- `src/modules/auth`: guest auth today, full auth later
- `src/modules/vehicles`: synced vehicle endpoints
- `src/modules/entries`: synced fuel and maintenance endpoints
- `src/modules/health`: health and service status

## Planned Production Direction

This structure is designed so the next upgrades can happen without changing the
mobile sync contract:

- replace file JSON persistence with Postgres
- add proper account auth
- add pull sync and conflict resolution
- add subscription entitlements
- add curated vehicle catalog and domain data

## Notes

Do not move core product learning into the backend too early.

The backend should support the app, not slow it down. Keep the mobile app
usable offline even after backend introduction.
