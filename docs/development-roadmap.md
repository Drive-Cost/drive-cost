# Development Roadmap

This is the source of truth for engineering progress and operational readiness.
It records implementation status, dependencies, and technical exit criteria;
the [product roadmap](product-roadmap.md) owns customer-facing sequencing.

Architecture rules live in [app architecture](app-architecture.md) and
[architecture decisions](architecture-decisions.md). Quality gates live in the
[Definition of Done](definition-of-done.md).

## Phase 1: Reliability Foundation

Status: complete.

- [x] Add a persistent client ID to locally created vehicles and entries.
- [x] Add local schema migration helpers and indexes for primary query paths.
- [x] Stop assuming a localhost backend exists in every installed app.
- [x] Add type-check commands for the mobile and backend modules.
- [x] Validate form input and odometer invariants before a database write.
- [x] Replace untyped navigation and unsafe casts with typed route parameters.
- [x] Add unit tests for cost calculations and form validation.
- [x] Add CI to run type checks and tests on every pull request.
- [x] Add deterministic sync retry policy tests without requiring Expo runtime.
- [x] Commit a local write and its outbox job in one SQLite transaction.

## Phase 2: Honest Local Product

Status: in progress.

- [x] Add delete flows for fuel and maintenance entries.
- [x] Add edit flows for fuel and maintenance entries.
- [x] Let fuel and maintenance entries record and edit their calendar date.
- [x] Show a complete, chronologically ordered vehicle history.
- [x] Show clear local-only, syncing, synced, and recoverable sync states.
- [ ] Show useful empty states and recoverable form errors.
- [x] Reconcile ICE fuel, EV charging, and legacy EV fuel records into clear
  domain concepts while preserving a unified energy-cost dashboard.
- [ ] Add ownership expenses: insurance, tax, inspections, tyres, and related
  tracked categories. Depreciation remains a separately labelled future model.
- [x] Define a tracked-interval calculation result with category, source, and
  distance-basis provenance for dashboard values.
- [x] Label dashboard aggregates as since-tracking metrics, state their
  supported-category limits, and keep routine successful sync unobtrusive.
- [x] Replace action-oriented permanent tabs with Home, History, Add, Garage,
  and Settings. Add keeps the existing fuel-only capture path for PHEVs until
  dual-energy semantics are defined.
- [x] Make Add flows quick, vehicle-contextual, locally saved entry forms for
  fill-ups, charges, maintenance, one-off ownership expenses, and odometer
  updates. Recurring commitments remain in ownership-expense management.
- [x] Reduce initial vehicle setup to the fields needed to begin tracking,
  initialize its tracking anchors from the current odometer and local date,
  and keep advanced profile metadata in vehicle editing.
- [x] Redesign Home around the active vehicle's transaction-based tracked
  costs, cost per distance, normalized recurring commitments, cost breakdown,
  deterministic insights, and recent activity without surfacing normal sync.

## Phase 3: Production Backend

Status: core sync complete; production hardening in progress.

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
- [x] Propagate idempotent fuel and maintenance deletions with tombstones that
  prevent stale device writes from restoring deleted entries.
- [x] Share typed sync and Problem Details contracts between mobile and backend.
- [x] Write Postgres entity upserts and change-feed records in one transaction.
- [x] Return RFC 9457 Problem Details for validation, authentication, conflict, and server failures.
- [x] Add migration `004_sync_entity_type_parity` so production Postgres accepts
  every shared sync entity: vehicle, fuel entry, charging entry, maintenance
  entry, ownership expense (`expense_entry`), and recurring expense. Real
  Postgres tests now assert schema parity, user isolation, and tombstone scope.
- [x] Replace long-lived bearer tokens with 15-minute HS256 access JWTs and
  rotating, revocable, server-side refresh sessions with a 30-day inactivity
  lifetime. Add atomic guest-to-registered upgrade while preserving the same
  user and sync ownership, plus in-memory beta rate limits for public auth
  endpoints. Migration `005_auth_sessions` is covered by the Postgres suite.
- [ ] Add account recovery and email verification.
- [x] Add the mobile session foundation: a single SecureStore session record,
  refresh rotation with single-flight retry, persisted one-owner dataset
  binding, owner-scoped pull cursors, and deterministic local-only,
  reauthentication-required, and account-mismatch sync states. Account UI and
  explicit dataset adoption remain deferred.
- [ ] Add backup/restore, observability, and encrypted-secret operations.
- [ ] Define and implement a vehicle-deletion policy before enabling vehicle deletion.

## Phase 4: Beta Operations

Status: release identity prepared; distribution readiness in progress.

- [x] Establish the first local-only closed-rollout application identity:
  DriveCost version `0.1.0`, iOS bundle identifier
  `com.goncalofrutuoso.drivecost` (build number `1`), and Android package
  identifier `com.goncalofrutuoso.drivecost` (version code `1`). Platform
  build numbers can advance independently of the app version.
- [x] Keep the closed rollout usable without an account or network connection;
  authentication is not required for this first local-only beta.
- [ ] Replace the Expo starter asset set before distribution: a production
  1024×1024 square PNG app icon (no rounded corners or transparent padding),
  a transparent 1024×1024 PNG splash logo, and Android adaptive-icon
  foreground, background, and monochrome layers with matching canvases. The
  Android artwork must use a 108×108 dp canvas, keep the logo within the
  centered 66×66 dp safe zone, and have clean edges without a mask or shadow.
  The web favicon also remains a starter asset.

- [ ] Verify the private-beta sync journey across two devices and recovery from
  offline and recoverable server failures.
- [ ] Add monitoring, incident diagnostics, and backup/restore exercises.
- [ ] Complete security and privacy review for account and synchronized data.
- [ ] Establish release checks for migrations, contracts, mobile, and backend.

## Exit Criteria For Backend Sync

The backend is ready for a private beta when an authenticated user can create a
vehicle and entries offline, reopen the app, sync them on two devices, and see
the same result without duplicates or lost edits.

It is not production-ready until account recovery, token rotation, rate
limiting, monitoring, backups, and a vehicle-deletion policy are in place.
