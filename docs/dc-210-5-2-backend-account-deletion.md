# DC-210.5.2 — Backend account deletion

Implemented 12 October 2026. Backend foundation only. The completed DC-210.5.1
lifecycle audit is recorded in the task conversation; this document records the
implemented contract and its remaining release decisions. Mobile deletion UI,
SQLite cleanup, account switching, recovery/verification, telemetry, analytics,
and the store request website remain outside this task.

## API and confirmation

`POST /account/deletion` requires the normal bearer access JWT and a JSON body:

- Registered account: `{ operationSecret, password }`.
- Legacy guest: `{ operationSecret, refreshToken }`.

Generate a fresh operation secret from **32 cryptographically random bytes**, in
canonical unpadded base64url form (43 characters). Persist it securely on the
initiating device before sending. Never place it in URLs, business SQLite, or
logs. The server validates its encoding; it cannot verify client RNG quality.
The client supplies no account ID/email; unexpected deletion fields are rejected.
The authenticated JWT subject and session ID are the only targets.

The persisted account mode decides confirmation. Registered accounts always
require their current password, including when the JWT still claims guest mode.
Guests instead prove possession of the current refresh credential for the live
initiating session. Missing, revoked, expired, or foreign sessions cannot delete.
This adds no automatic guest creation and preserves guest upgrade.

Success is HTTP 200 with exactly
`{ status: 'completed', deletedUserId, completedAt }`, after commit. Confirmation
failure is a 403 Problem Details response, so it is distinct from token expiry.
Missing accounts produce 410 `account-unavailable`; invalid sessions/credentials
produce 401; secret reuse produces 409 `deletion-operation-conflict`; validation
and rate limits retain the existing Problem Details conventions. Database/file
failures are retryable 500 responses and do not claim account deletion.

Confirmation requests are limited to five per minute per IP **and** authenticated
account; status requests to 30 per minute per IP. These use the existing
process-local rate-limit store. Production with multiple instances needs a shared
limit or equivalent gateway enforcement before these become deployment-wide
limits. No new rate-limit infrastructure is introduced here.

## Recovery receipts

`POST /account/deletion/status` accepts `{ operationSecret }`, without account
authentication. Possession authorizes only recovery of that operation's completion
receipt, never account access or business data. Both successful endpoints return
`Cache-Control: no-store`. A checked shared decoder rejects malformed evidence.

The database stores only SHA-256 of the random operation secret, deleted user ID,
completion time, and expiry. Migration `006_account_deletion_receipts` deliberately
has no FK to the removed user. A unique hash prevents a reused secret from deleting
a second account, including concurrent requests. Recovery replay returns the same
minimal receipt. Retrying deletion using a deleted account's JWT cannot authenticate;
use status recovery instead.

**Missing/expired receipt means `{ status: 'unknown' }`.** It proves neither
success nor failure. A timeout, 5xx, 401/410, or a successful empty sync response is
never deletion evidence and must never authorize local cleanup. Recovery must
verify the receipt's user ID matches the pending deletion owner.

**Proposed privacy policy, awaiting product/privacy approval:** retain these minimal
receipts for 30 days after completion. The implementation has that finite lifetime;
expired receipts are removed during deletion/status operations. Run
`DATABASE_URL=… npm run db:purge-deletion-receipts` daily for physical expiry cleanup
when the API is idle; production scheduling is a release prerequisite, not included
in this task. Expired receipt secrets can be reused as fresh operations, but clients
must always generate fresh ones. Longer offline recovery would need an approved
longer retention period. No indefinite recovery identity or email journal is added.

## PostgreSQL transaction and concurrency

Deletion locks the user `FOR UPDATE`, then the matching live session `FOR UPDATE`,
verifies confirmation while those locks are held, inserts the receipt, physically
deletes the user, and commits. Existing FKs cascade to every sync entity, its
tombstones, the complete change-feed history, and all active/revoked refresh
sessions. Password hash/email disappear with the user. No sync deletion tombstones
are created for account deletion.

Ordinary sync mutations and session creation take a user `FOR KEY SHARE` lock
before entity/session locks, inside their transactions. Refresh looks up its owner,
then locks the account before rotating its session. Guest upgrade takes the account
exclusive lock before updating identity/session state. Thus earlier writes/session
creation finish before deletion and are subsequently purged; later contenders see
no account and cannot append data or recreate sessions. Failed deletion rolls back
both the receipt and cascades, leaving safe retry possible.

Every authenticated route now checks current account existence after JWT verification.
Previously issued access JWTs lose access once deletion commits. Ordinary sign-out
still revokes only the presented refresh session: a JWT for an **existing** user
remains usable until its existing short expiry. No per-session revocation check is
added to ordinary routes. A database outage returns 500, never false deletion.
Read requests already in flight before deletion may complete; deletion fences writes
and session creation. There is no distributed recall of previously delivered data.

Re-registering the same email creates a new random user identity. Old JWT subjects,
refresh sessions, cursors, and ownership do not transfer to it. Normal login,
registration, guest upgrade, refresh rotation, and guarded adoption remain intact.

## File development adapter

The adapter removes the user's identity, sessions, all six business collections,
and change history in one snapshot with the receipt. Asynchronous password
confirmation re-reads and revalidates account/session state before its synchronous
commit, so upgrade, refresh, revocation, or deletion during confirmation cannot
reuse stale authorization. Concurrent business writes are included in the freshly
read snapshot and purged with their owner.

Writes use a private sibling temporary file, file fsync, atomic rename, and directory
fsync. Pre-rename failures preserve the old snapshot and clean the temporary file.
A post-rename failure gives no HTTP success; status can recover the receipt only
after completing directory durability. This is isolated file persistence behavior,
not a general transaction framework. It supports **one Node process only**, not
multiple workers/processes or production storage. Device/hardware/filesystem power
failure guarantees depend on the filesystem honoring fsync and atomic rename.

A persisted next-change sequence replaces array-length allocation. Legacy snapshots
initialize it above their maximum existing sequence before pruning; deletion never
resets/decrements it. Other users' existing cursors remain valid even when the
highest feed records belonged to the deleted account.

## Exact safety invariants

1. Only the authenticated live identity/session can initiate deletion; registered
   password confirmation is never substituted with a guest credential.
2. A completed receipt and physical cloud deletion commit together, or neither does.
3. Deleted identities accept no later authenticated mutation/session creation; offline
   clients cannot resurrect them through sync or refresh.
4. Secret possession recovers minimal completion evidence only. Unknown outcome is
   never cleanup authority. Recovery cannot delete a different identity.
5. Every unrelated user's records, sessions, history, and cursor semantics survive.
6. Deletion differs from sign-out and from removing a device's local data.
7. **This backend task changes no mobile state.** A later mobile implementation must
   remove the associated SQLite dataset, binding, owner cursor, outbox, adoption
   queue, and secure credentials only after a matching verified completion receipt.
   Unknown results preserve all of them and block unsafe reassignment. Other offline
   devices retain their local data/binding with sync blocked when that old identity
   is unavailable; they must not automatically unbind, create a guest, or upload to
   a newly registered identity. Those UI/cleanup changes are deliberately deferred.

## Verification and remaining decisions

Regression tests run shared lifecycle cases against file and real PostgreSQL:
all entity types/history/tombstones/sessions, wrong password, authorization/live
sessions, guest proof and upgraded mode, unrelated users, old JWT denial, same-email
new identity, receipt collisions/replay/restart/unknown status. Focused cases cover
legacy cursor migration, file failure boundaries and interrupted confirmation,
credential-safe logs, rate limits, PostgreSQL lock races in both directions,
transaction rollback, receipt schema/expiry, and checked recovery contracts.

Required checks: contracts build/typecheck; backend lint/build/typecheck/tests;
real PostgreSQL migration/integration tests; `git diff --check`. The dedicated
PostgreSQL command now discovers all `*.postgres.test.ts` files.

Completed verification: contracts build/typecheck, backend lint/build/typecheck,
22 ordinary backend tests, and 16 real PostgreSQL integration tests (no skips in
that dedicated run) passed. The ordinary suite skips those 16 database cases by
design. New source/test formatting and `git diff --check` passed. The receipt
maintenance command ran successfully against the isolated test database. Mobile
code was untouched. The isolated PostgreSQL container and volume were cleaned up.

SQL deletion does not instantly erase backup/WAL copies or already downloaded
copies on other devices. Product/privacy approval is still required for receipt
retention, backup/WAL expiry, any legally required exceptions, and restore handling.
A restored pre-deletion backup can resurrect an account unless deletion evidence
is replayed before authentication/sync resumes. The short-lived recovery table is
**not** a complete backup-restore deletion journal; retention and a restore process
must be agreed before production. No hidden legal retention or indefinite journal
is implemented.

Store obligations identified by DC-210.5.1 remain: Apple's in-app account-deletion
path and Google Play's in-app path plus an external deletion-request page. Building
that page or email infrastructure, mobile confirmation/cleanup, native release QA,
and production maintenance scheduling are subsequent tickets.
