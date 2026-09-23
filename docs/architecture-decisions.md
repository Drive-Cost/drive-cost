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

The Postgres entity-type constraints must contain exactly the shared contract's
current set: vehicle, fuel entry, charging entry, maintenance entry, ownership
expense (`expense_entry`), and recurring expense. Forward-only migration
`004_sync_entity_type_parity` and real-Postgres integration tests protect this
parity from future drift.

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

Each accepted Postgres mutation emits a user-scoped change with a monotonic
cursor. Clients request changes after their last cursor and apply them in order.
For the current single-owner vehicle model, the server uses last-write-wins for
the same user, entity type, and client ID.

Fuel, charging, maintenance, one-off ownership-expense, recurring-schedule,
and vehicle deletions are represented as tombstones in the shared change feed.
A tombstone deletes the local row by client ID, is safe to replay, and rejects
stale later upserts so an offline device cannot resurrect a deleted record.

A vehicle tombstone is authoritative for its owned entries. Local SQLite uses
foreign-key cascades to remove fuel, charging, maintenance, one-off expense,
and recurring-expense rows atomically with the vehicle. The backend emits the
vehicle tombstone followed by tombstones for every active owned entry in the
same transaction. A later entry upsert must verify that its parent vehicle is
still active, so an offline device cannot restore child data after deletion.

## ADR-011: Mobile Authentication Uses Short-Lived Access Tokens And Rotating Sessions

DriveCost uses 15-minute HS256 access JWTs with a fixed issuer
(`https://api.drivecost.app`) and audience (`drivecost-mobile`). They carry the
user ID, account mode, and session ID required to authorize an API request;
they do not carry credentials or database session state. The server verifies
the algorithm, issuer, and audience without looking up a session for every
normal authenticated request.

Refresh sessions are server-side records. The mobile credential is an opaque
`<session-id>.<random-secret>` value, while storage contains only a SHA-256
hash of its high-entropy secret. Refresh rotates the secret atomically and
renews a 30-day inactivity expiry. Sessions are independently revocable, so a
user can sign in on multiple devices without revoking the others. Logout
revokes only the presented refresh session; an access JWT may remain valid
until its short expiry.

Guest upgrade changes the same persisted user from guest to registered in one
transaction, revokes the current guest session, and creates a registered
session. Vehicle ownership and the change feed remain attached to the same
user ID. A pre-upgrade access token can remain valid briefly, but it has no
cross-user authority.

## ADR-012: A Local Dataset Has One Explicit Cloud Owner

The mobile SQLite dataset is either unbound or bound to one persisted cloud
user ID and mode. This binding is non-secret SQLite metadata, separate from
SecureStore credentials, so losing or clearing credentials never transfers or
unbounds local business data. A matching authenticated session is required
before either outbox push or pull sync; an unbound dataset remains fully local,
and a different authenticated user produces an account-mismatch state rather
than a merge or replacement.

Pull cursors are stored under the bound owner ID because backend cursors are
account-specific. Existing access-token-only installations are treated
conservatively: when their token exposes an unambiguous legacy user identity,
the app preserves that owner binding but requires reauthentication. It never
creates a replacement guest or guesses ownership from business rows.
