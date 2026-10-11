# DC-210.4.2 — Existing-account access

Implemented 12 October 2026. This completes existing-account sign-in, explicit
unbound-device data choices, and registered-account sign-out. DC-210.4.1 account
creation/guest upgrade, the recent consistency fixes, and all five primary tabs
remain in place. Account switching, deletion, recovery, telemetry, and broader
Settings work are excluded.

## Flows

- **Empty unbound installation:** authenticate, obtain the complete account
  feed, import it and bind its owner/cursor, then activate credentials. No data
  choice is shown. A failed download leaves the installation unbound.
- **Non-empty unbound installation:** login returns an isolated, in-memory
  session. No normal sync, durable credentials, or binding occurs until the
  user selects **Add this data to my account** or **Use my account data
  instead**. Back/Cancel revokes the temporary session best-effort; cancellation
  during preflight prevents local commit. Leaving Sign In also invalidates an
  outstanding login. Passwords and tokens never enter navigation parameters.
- **Add device data:** obtain the account feed first and check every local
  identity and pending operation. Keep existing local rows, IDs, timestamps,
  and legitimate pending upserts. Import disjoint remote records, establish
  durable bootstrap uploads, and bind the owner/cursor in one transaction.
  Preserve a valid active local vehicle.
- **Use account data:** require an additional destructive confirmation. Fetch
  every remote page before entering the reset transaction. Reset business rows,
  pending jobs, adoption jobs, and ownership/cursor metadata, import the fetched
  feed, and bind its owner/cursor together. Preserve unrelated configuration.
  Import or binding failure rolls back the entire reset. Recheck the local
  dataset before commit, so records changed during preflight are not erased.
- **Bound account:** sign-in accepts only the same registered user ID. A bound
  guest's supported path remains upgrading that guest in place. Another user
  cannot adopt or replace either bound dataset.
- **Sign out:** persist local sign-out intent, remove current and retired
  credentials, and pause
  authenticated sync. Preserve every business row, pending mutation, adoption
  upload, owner binding, and owner-specific cursor. Backend logout is
  best-effort and does not delay local completion. Settings shows Signed out
  and Sign in to resume sync; local recording continues to work.

A completed data choice cannot be undone by cancelling afterward. A connection
failure after its SQLite commit offers connection retry, rather than another
destructive data choice. Restart recovery requires the committed account ID.

## Adoption safety and push/pull order

Normal sync pushes before it pulls. Blindly binding an unbound dataset could
therefore overwrite cloud records before discovering their matching IDs.

Preflight reads the full account feed with the isolated session's token.
Matching `(entityType, clientId)` identities, including historical records and
tombstones, reject adoption before binding. Unbound data has no ownership proof
that an equal ID represents the same logical record. Malformed jobs, deletion
jobs, missing local targets, and mismatched parent references also reject
adoption without discarding anything. Incomplete owner metadata is not treated
as a freely adoptable dataset.

A preflight alone cannot exclude concurrent writes from another device. Initial
adoption uploads use dedicated `/…/adoption` endpoints and a create-only
repository operation. An existing different payload or tombstone produces a
409 without changing it. Exact replay acknowledges the same content without
creating a record or change-feed duplicate. Postgres enforces this at the unique
user/entity/client-ID key, including concurrent inserts. Account ownership and
normal last-write-wins upserts are unchanged.

The sync feed advertises `create-only-v1`; unsupported servers reject adoption
preflight. Dedicated upload paths also fail safely on an older server after a
rollback, instead of falling through to an ordinary upsert.

The additive `account_adoption_queue` migration stores one initial snapshot per
local entity, its owner, and the pre-adoption outbox cutoff. Parent vehicles
upload before entries. Existing pending upserts remain until that entity's
current snapshot is acknowledged, then are coalesced as delivered in the same
SQLite transaction as removing its bootstrap job. Mutations created after the
cutoff remain queued. No existing job IDs or timestamps are rewritten.

Only after all bootstrap uploads succeed may normal push and pull continue.
Failures retain uploads and pending jobs. This prevents an early pull from
replacing adopted records whose initial upload has not been established safely.

## SecureStore and SQLite boundary

SQLite and SecureStore cannot share a transaction. Binding/import commits with
`session_blocked=1`; credentials activate afterward, and only then is the block
cleared for the matching owner. Interrupted credential persistence leaves a
valid, blocked binding, not a partial or transferable dataset. Same-account
sign-in recovers it without repeating a replacement.

Sign-out also persists this marker before deleting credentials. Startup honors
it before restoring or refreshing any stored session. Secure-storage deletion
failure cannot silently restore authenticated sync on restart. Sync checks
owner/session access around requests and before applying pull data, acknowledging
jobs, or reporting completion. In-flight network requests cannot be recalled,
but their late results cannot enable another account or discard a signed-out
installation's pending work.

The existing refresh logic is preserved: temporary connectivity/server errors
keep recoverable credentials, and no automatic guest creation is introduced.

## Implementation boundaries

- `services/account/accountAccess.ts`: sign-in, choice, cancellation, activation,
  and sign-out use cases; temporary credentials remain private.
- `database/accountDataRepository.ts`: dataset snapshots, atomic reset/binding,
  and durable adoption delivery acknowledgements.
- `database/migrations/accountAdoption.ts`: additive, repeatable queue migration.
- `services/account/adoptionPolicy.ts`: checked adoption inputs and rejection.
- `services/account/pushAdoptedData.ts`: parent-first guarded initial uploads.
- `screens/AccountDataChoice/`: typed decision lifecycle and confirmation UI.
- Sign In, Settings, navigation, API, and sync entry points connect these flows.
- Backend vehicle/entry services and file/Postgres repositories enforce the
  conditional creation rule; shared contracts declare the protocol capability.

No form reducer, local mutation implementation, domain cost calculation, or
vehicle-cache implementation was refactored. Existing cache loading operations
refresh affected vehicles, including removing old snapshots after replacement.
An empty maintenance description is now accepted by the shared decoder, matching
the existing local form and backend schema; adoption of that valid entry type
exposed this mismatch.

## Verification

Focused regressions cover all six adopted entity types, collision/tombstone
rejection, unsafe pending operations, guarded delivery ordering, failed and
partial remote preflight, changed local data, cancellation, interrupted binding
and activation, safe retry, migration preservation, offline sign-out, failed
secure deletion, late push/pull results, restart, and cross-account isolation.
Existing creation, guest-upgrade, refresh, reducer, save, cache, and navigation
regressions remain enabled.

Run from the appropriate package:

- Contracts: `npm run build`, `npm run typecheck`.
- Mobile: `npm run lint`, `npm run typecheck`, `npm test`, `npm run check-style`.
- Backend: `npm run lint`, `npm run build`, `npm run typecheck`, `npm test`.
- Postgres: `DATABASE_URL=… npm run test:postgres` against the isolated test DB.
- Repository: `git diff --check`.

All required checks passed: 315 mobile tests across 56 files, 13 backend tests,
and eight real-Postgres integration tests with no skips in that dedicated run.
Mobile lint/typecheck/style, contracts build/typecheck, backend lint/build/typecheck,
and `git diff --check` passed. Android export also passed. The ordinary backend
suite skips Postgres cases by design; they were executed separately against the
isolated DC-210.4.2 Compose database.

## Deliberately deferred risks

- An offline or interrupted logout can leave a server refresh session active
  until expiry/revocation. No revocation credential is placed in SQLite.
- A concurrent conflicting cloud write after preflight stops bootstrap delivery
  safely. Earlier non-conflicting uploads may already exist in that account;
  they were explicitly authorized. An interactive conflict-resolution workflow
  and automatic re-identification are deferred.
- Unbound deletion jobs and unverifiable pending operations require rejection,
  not guessing which cloud data they should affect.
- Full remote history is held in memory during preflight. Large-dataset
  streaming/staging is deferred; there is no new migration/merge framework.
- Closing after refresh rotation but before successful secure persistence can
  still require reauthentication, as accepted for the consistency milestone.
- Native device/two-device release QA remains separate from this implementation.
