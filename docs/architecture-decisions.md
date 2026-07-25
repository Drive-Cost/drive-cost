# Architecture Decisions

## ADR-001: Keep TypeScript For The First Production Iteration

DriveCost will use TypeScript in the Expo mobile app and the backend module.
The current product risk is correctness of local-first data handling, not
native runtime performance. Sharing types, validation rules, API contracts, and
test tooling makes the small team faster while the problem space is still
changing. A future native client or Kotlin backend remains a valid replacement
decision once real usage demonstrates a concrete limitation.

## ADR-002: Local SQLite Is The Source Of Truth On Device

User actions write to SQLite first. Network delivery happens through a durable
outbox and must not block the interface. The server is a replicated account
store, not a dependency for recording a trip, fill-up, or repair.

## ADR-003: Client IDs Are Stable And Opaque

Every syncable local entity has a generated `clientId`, persisted with the
record. The same ID is sent for every retry and later update. Local SQLite
numeric IDs are device implementation details and must never be used as cloud
identity. Entry payloads carry their parent vehicle's client ID.

## ADR-004: Sync Is Idempotent, Ordered, And Backed Off

Outbox jobs are processed oldest first. A successful job is removed only after
the server acknowledges it. Failed jobs retain the error, wait before retrying,
and do not prevent local use. A production implementation will add exponential
backoff, authentication, pull cursors, conflict resolution, and observability.

## ADR-005: JSON Storage Is Development-Only

The backend's JSON file adapter is useful for local wiring, but it is not a
multi-user datastore. Production requires Postgres, migrations, transaction
boundaries, user-scoped queries, and automated backup.

## ADR-006: Feature Slices On Mobile, Modular Layers On The Backend

Mobile code will gradually move from global technical folders to feature slices
as it changes. React Navigation stays in place because file-based routing does
not currently solve a product problem. The backend uses modules with HTTP,
service, and repository boundaries; this preserves the useful separation seen
in Gomoku-Web without copying its larger structure before DriveCost needs it.

## ADR-007: Device Tokens Live In Secure Storage, Not SQLite

The mobile app stores its backend bearer token in Expo SecureStore and keeps
local business data in SQLite. This prevents the local database from becoming a
credential store while preserving offline use when no token or network exists.
Guest sessions are a low-friction bridge to account sync; account recovery and
token rotation are required before public release.

## ADR-008: Sync Entities Use A Generic Postgres Envelope

Postgres stores every syncable vehicle or entry in a single `sync_entities`
table with an entity type, user-owned client ID, JSONB payload, timestamps, and
monotonic sequence. This prevents duplicated upsert and cursor logic while the
JSONB payload keeps the evolving local-first domain flexible. When a query path
becomes hot or a domain rule needs database enforcement, its fields can be
promoted into explicit columns in a later migration.

## ADR-009: Postgres Is The Primary System Of Record

DriveCost uses Postgres for account data and synchronized ownership records. It
matches the transactional, relational, user-scoped nature of the product while
also supporting indexed JSONB for an evolving sync envelope. DuckDB is a future
option for analytical exports or local reporting, not online account storage.
Redis may be added for ephemeral caching, rate limits, or short-lived jobs, and
RabbitMQ only when asynchronous workloads justify an external broker. Neither
is a replacement for the primary database. Cassandra and CouchDB add operating
and consistency complexity without solving a demonstrated DriveCost need.

## ADR-010: Pull Sync Uses An Append-Only Cursor Feed

Each accepted Postgres upsert will emit a user-scoped change with a monotonic
cursor. Clients request changes after their last cursor and apply them in order.
For the current single-owner vehicle model, the server uses last-write-wins for
the same user, entity type, and client ID. Deletions and shared-vehicle editing
are intentionally deferred until they have explicit tombstone and conflict UX.
