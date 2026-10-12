# DC-210.5.3 — Mobile account deletion and lifecycle recovery

Implemented 12 October 2026. Reuses the unchanged DC-210.5.2 backend and shared
contracts. Account switching, password recovery/verification, telemetry, analytics,
store request website, backup infrastructure, and other roadmap work are excluded.
The DC-210.5.1 lifecycle audit remains in the task conversation.

## Product flows

Settings → Account → **Delete account** opens a dedicated screen under the existing
root stack. The five primary tabs remain unchanged. Opening or cancelling the
confirmation makes no deletion request. Registered accounts show their email when
available and require the current password using secure text entry. Legacy guests
use the current refresh credential without a password. Missing/mismatched sessions
cannot delete, and guests without their original credential see a blocked state;
no replacement guest or guessed ownership is created.

The confirmation explains permanent cloud deletion, removal of **all** DriveCost
business data on this device (including unsynced records), the limits on offline
copies elsewhere, and irreversibility. One explicit destructive action is used;
there is no second dialog or typing challenge. Duplicate taps share one operation.
Passwords remain only in the input/call lifetime, are cleared from the reducer at
submission, and are never stored, logged, or placed in navigation parameters.
An explicit wrong-password 403 preserves records, restores ordinary access, and
allows correction. The client never refreshes/retries that deletion request through
an unrelated authentication flow. Other uncertain responses preserve recovery.

After a verified deletion and completed device cleanup, the screen confirms both
cloud and device removal. Continue returns to Settings in the existing local-only
shell. The installation remains usable without registration or automatic identity
creation. **Sign out** continues to preserve the cloud account, local records,
outbox, adoption queue, owner, and cursor, and requires the same account to resume.

## Secure intent and lifecycle

Expo Crypto supplies 32 cryptographically secure random bytes, encoded as canonical
unpadded base64url (43 characters), as required by the existing protocol. This is
why the native `expo-crypto` dependency was added; the existing client-ID generator
is not used for recovery secrets. See the [SDK 55 API](https://docs.expo.dev/versions/v55.0.0/sdk/crypto/).

Before any destructive HTTP request, the service:

1. Captures a deterministic SHA-256 signature of all raw business rows/fields in
   all six tables, ordered by local row ID, at the submission boundary.
2. Checks/restores a matching registered or guest session, settles any in-flight
   refresh rotation, and fences new account activity before capturing its live proof.
3. Writes `{ ownerId, operationSecret }` to SecureStore under a dedicated versioned
   key with device-only keychain accessibility, and verifies the saved value.
4. Invalidates outstanding credential publication and commits the non-secret deletion intent plus session fence in SQLite.
5. Only then sends the existing authenticated deletion request.

A failed secret write/readback or intent transaction prevents the HTTP request.
The secret is never written to SQLite, URLs, navigation, or logs. SQLite stores only
owner/mode, phase, approved dataset signature, and verified completion timestamp.
This is an additive `sync_state` key: absent metadata means no deletion in progress;
no schema migration or business-row rewrite is required.

Durable phases are **unknown**, **confirmed**, **cleanup**, and **cleared**. A small
**rejected** phase allows restart to finish discarding an explicitly rejected
confirmation if secure cleanup was interrupted. The screen has its own `State`,
`Action`, and `reduce`, while service/repository code owns side effects. No generic
workflow engine is introduced.

## Unknown outcomes and consent

A timeout, incomplete body, generic 401/410, rate limit, outage, malformed response,
or wrong-owner receipt never authorizes cleanup. The API timeout also covers reading
the response body. After uncertainty, records, ownership, pending work, and the same
recovery secret remain; authenticated delivery and account activation stay blocked.
The user can keep recording locally.

The screen explains that deletion could not be confirmed, that the records remain
on this device, and that syncing is paused. **Check deletion status** calls the
existing unauthenticated capability endpoint without sending a bearer token. Only
a checked `completed` response for the pending owner permits further cleanup.
`unknown` or failed status checks preserve the dataset and fence. No unrelated
operation secret is generated during recovery.

The signature excludes retry bookkeeping but covers every business table, field,
row, and orphan; counts and active selection are insufficient. If it differs from
the submission snapshot, the cloud is already deleted but device removal pauses.
The screen explains the additional/changed records and requires explicit renewed
confirmation. That action supplies the reviewed signature; another intervening
change requires confirmation again. Changes during secure-intent preparation are
also detected. No newly recorded data is silently erased.

## SQLite and SecureStore cleanup

Verified cloud completion is saved first. Device cleanup then pauses local writes,
checks owner/signature under SQLite's exclusive transaction, and commits cleanup
intent. Only an approved, matching dataset proceeds to removal; a changed dataset
returns to confirmation and local recording remains available.

A single repository reset, in one SQLite transaction, clears vehicles, fuel,
charging, maintenance, ownership expenses, recurring expenses, every outbox job,
the adoption queue, owner ID/mode, owner-specific cursors, and account-unavailable
metadata. That transaction replaces the lifecycle with **cleared** and retains the
session block. Unrelated application configuration is preserved. Active vehicle
selection and every business store/cache are reset afterward.

The service next deletes current and retired SecureStore credentials and the
operation secret. Only after all removals succeed does a final SQLite transaction
remove the lifecycle marker and release the session fence. Only then is completion
published. SQLite failure rolls back dataset/owner/job removal together. SecureStore
or final-marker failure leaves a durable **cleared** block and **Retry device cleanup**.
Restart can retry credential removal even when the secret was already removed;
verified local intent supplies the cleanup authority.

Startup restores this lifecycle before loading account data or starting auth/sync.
Unknown outcomes never restore/refresh old credentials. Confirmed cleanup resumes
when the signature still matches, otherwise asks for renewed consent. Cleared
cleanup retries secure removal. Corrupt lifecycle metadata fails closed and preserves
records. Leaving the screen after submission changes no durable deletion state and
does not pretend to cancel a server operation.

## In-flight fences

Existing owner/session checks remain the sync boundary. Deletion adds a small
in-memory account block and dataset generation plus the durable lifecycle marker:

- Push acknowledgement checks the owner inside its SQLite transaction; late errors
  cannot mutate an obsolete job. Pull/adoption validate the fence before and after
  their transaction. Late responses cannot reinsert rows or acknowledge erased work.
- Refresh/session restoration and secure credential publication check context state
  and generation. Pending rotations cannot reactivate a deleted account. Binding,
  sign-in/data choices, creation/upgrade, and sign-out cannot override recovery.
- Final cleanup temporarily blocks local mutations. Old writes check the fence at
  transaction entry and before commit; a superseded write rolls back. Successful
  reset advances the dataset generation before removal, so queued older writes and
  their later store/navigation success paths cannot target the fresh dataset.
- Store mutation publishers and vehicle/entry loads check the dataset generation.
  Older snapshots cannot replace the cleared store or active selection. Existing
  per-vehicle cache generations and atomic save algorithms remain in place.
- Old sync passes cannot publish completion over the new local-only context.

Normal offline saves still finish at their local atomic commit. The unknown-outcome
phase does not block local recording; only the final cleanup window/pending cleanup
blocks new writes. Context generations need not persist across process restart:
old JavaScript callbacks do not survive restart, and SQLite intent supplies the
startup fence.

## Secondary devices and limitations

Only an authenticated, explicit `410 account-unavailable` Problem Details response
establishes terminal loss of the old cloud identity. Its device persists an
account-unavailable fence, stops delivery/activation for that owner, and preserves
all local data and binding. Generic 401/refresh expiry cannot prove deletion and
never removes records. A secondary device with an expired access JWT may receive
only 401 and need reauthentication; it must still retain its data/owner rather than
guess why access ended.

Offline devices cannot be remotely erased. There is no automatic transfer to a new
identity or account switching. Secondary local erasure is not implemented without
matching deletion evidence/explicit consent; a separately approved device-data
removal policy remains a release dependency.

Receipts retain the **provisional 30-day policy pending product/privacy approval**.
If the receipt expires, the secure secret is permanently lost, or the app stops
between persisting intent and sending the request, a missing receipt remains
unknown. Data/fencing is preserved rather than guessing or starting unrelated
requests. A policy for these unrecoverable cases is still needed before broad
release. Native SecureStore/filesystem reliability and real two-device interactions
require device QA; automated tests and Android export are not that QA.

Cloud deletion does not claim immediate physical erasure from backups/WAL or offline
copies. Backend retention approval, maintenance scheduling, deployment-wide rate
limits, restore safeguards, and the external Google Play deletion-request page
remain the DC-210.5.2 release dependencies. No new backup or website infrastructure
was added.

## Verification and affected areas

Focused service/repository tests use real in-memory SQLite and injected failure
boundaries. They cover all six tables/unsynced data, owner/cursors/adoption/config,
secret-before-request ordering, registered/guest confirmation, cancellation,
duplicates, status uncertainty/replay/restart, wrong-owner receipts, changes during
preparation/unknown outcome, rollback, secure cleanup/final-marker failures, late
writes/loads/push/pull/adoption/refresh/upgrade, and secondary terminal fencing.
Reducer, navigation, and API regressions cover correction, unchanged five tabs,
no credential parameters, anonymous status, and no deletion refresh/retry. Existing
sign-out, creation/upgrade, adoption/replacement, offline save, and refresh tests
remain enabled.

Main files: `screens/DeleteAccount/`, Settings/root navigation,
`services/account/accountDeletion.ts`, `database/accountDeletionRepository.ts`,
`store/accountDeletionStore.ts`, `services/app/datasetContext.ts`, and small guards
in account/session/sync/store boundaries. No backend or shared contract source was
changed. The approved workflow change is only its name.


Completed checks: contracts build/typecheck; backend lint/build/typecheck and
22 ordinary tests; 16 real PostgreSQL integration tests with no skips in the
dedicated run; mobile lint/typecheck, 361 tests across 59 files, formatting,
Android export, and `git diff --check`. The ordinary backend suite skips its
16 PostgreSQL cases by design; they were run separately against the isolated
DC-210.5.3 database, then its container/volume were removed. Final Android output
is `/private/tmp/drivecost-dc21053-final-android`. Native/device QA is outstanding.
