# Development Roadmap

## Engineering Principles

- Local writes must succeed without a network connection.
- A queued sync operation must be safe to replay more than once.
- The app owns stable client IDs; the server never infers identity from names,
  dates, or local SQLite row IDs.
- Domain rules are validated before persistence, not repaired in dashboard code.
- Every schema change is forward-only and preserves existing user data.

## Phase 1: Reliability Foundation

Status: in progress.

- [x] Add a persistent client ID to locally created vehicles and entries.
- [x] Add local schema migration helpers and indexes for primary query paths.
- [x] Stop assuming a localhost backend exists in every installed app.
- [x] Add type-check commands for the mobile and backend modules.
- [x] Validate form input and odometer invariants before a database write.
- [ ] Replace untyped navigation and unsafe casts with typed route parameters.
- [x] Add unit tests for cost calculations and form validation.
- [x] Add CI to run type checks and tests on every pull request.
- [x] Add deterministic sync retry policy tests without requiring Expo runtime.
- [x] Commit a local write and its outbox job in one SQLite transaction.

## Phase 2: Honest Local Product

- Add edit and delete flows for fuel and maintenance entries.
- [x] Show clear local-only, syncing, synced, and recoverable sync states.
- Show useful empty states and recoverable form errors.
- Split fuel and electric charging into clear domain concepts while preserving a
  unified energy-cost dashboard.
- Add ownership expenses: insurance, tax, inspections, tyres, and depreciation.
- Define calculation provenance so each dashboard value can be explained.

## Phase 3: Production Backend

- [x] Select Postgres as the transactional system of record.
- [x] Add signed guest sessions, password hashing, and email/password account endpoints.
- [x] Authenticate and user-scope sync writes and reads.
- [x] Validate backend request payloads with JSON Schema.
- [x] Add forward-only Postgres migrations and local Compose infrastructure.
- [x] Add a storage port with file and Postgres adapters.
- [x] Select the Postgres adapter through runtime configuration.
- [x] Add Compose-backed Postgres integration tests to CI.
- [x] Add an idempotent changes API with cursor-based pull sync and a
  last-write-wins conflict policy.
- [x] Reconcile cursor batches atomically into SQLite without touching the local outbox.
- [x] Share typed sync and Problem Details contracts between mobile and backend.
- [x] Write Postgres entity upserts and change-feed records in one transaction.
- [x] Return RFC 9457 Problem Details for validation, authentication, conflict, and server failures.
- [ ] Add refresh-token rotation, account recovery, rate limits, and email verification.
- Add backup/restore, observability, rate limits, and encrypted secrets.
- Integrate subscriptions only after the local retention loop is proven.

## Exit Criteria For Backend Sync

The backend is ready for a private beta when an authenticated user can create a
vehicle and entries offline, reopen the app, sync them on two devices, and see
the same result without duplicates or lost edits.

It is not production-ready until account recovery, token rotation, rate
limiting, remote deletion semantics, monitoring, and atomic local
write-plus-outbox persistence are in place.
