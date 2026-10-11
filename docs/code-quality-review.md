# Mobile code-quality review — 11 October 2026

## Current organization

The previous pass mixed a flat screen list with partial feature slices and put
non-UI editor logic under `components/`. That made ownership harder to follow.
The current mobile convention follows the requested screen-based organization:

```text
src/
  screens/
    Fuel/
      Screen.tsx
      reducer.ts             State, Action, Input, reduce
    AddVehicle/
      Screen.tsx
      reducer.ts
      components/
        CreateVehicleForm.tsx
    OwnershipExpenses/
      Screen.tsx
      reducer.ts
      components/
        RecurringCosts/
          Section.tsx
          reducer.ts
  components/                Shared UI only
  hooks/                     Reusable React hooks
  domain/                    Validation, units, identity
  models/                    Mobile persisted data
  services/                  Use cases, projections, DTO decoding
  store/                     Zustand coordination and caches
  database/                  SQLite repositories
  navigation/                Navigator composition and route types
```

Every screen has one implementation. Navigator imports point directly to it;
there are no compatibility re-export screen files. Screen-specific vehicle
forms and recurring-cost UI are colocated with their owners. Shared entry
fields/buttons, vehicle fields/type controls, and sync notices remain shared.
The original vehicle-form edits were carried into its new location.

## Reference projects and reasoning

Read Gomoku-Web's authentication reducers and its UI/domain/service layout.
Read DiGo-certify-app's Home screen, local certificate components, and emission
hook; the local project is named `DiGo-certify-app`, rather than `DiGo-Certify`.
DiGo's colocation and hook separation suit this mobile app. Gomoku's tagged
states provide useful interaction modeling. Neither project's implementation
should be copied wholesale: their domains differ, and some reference actions
accept arbitrary field names or permit incomplete error transitions.

A screen folder supplies the context for short reducer names. Concrete screen
`State` and `Action` types reveal exactly what that interaction permits. The
shared entry hook reuses only the identical edit/reset/selection mechanics;
each owning screen specializes them with its entry and input types. Fuel,
charging, payments, and recurring commitments retain distinct domain semantics.

Dashboard, History, Garage, and Add derive data from stores and domain
projections. Adding a reducer just to duplicate that data would create another
source to reconcile. They have screen folders but no empty reducer files.
Maintenance's single independent optional-details toggle remains `useState`.

Mobile object declarations now use `type` aliases, including tests and the old
prototype store. Oxlint enforces `consistent-type-definitions: type`. This is a
project convention; replacing an interface with an alias does not itself make
runtime data valid. The important properties are precise fields, discriminated
states, and checked boundaries.

## DTOs and runtime boundaries

The API's public outputs are now explicit:

| Operation | Output | Boundary behavior |
| --- | --- | --- |
| Login, registration, refresh, upgrade | `Promise<SessionResponse>` | Checks credentials, expiry, user ID/mode, and optional email; constructs a DTO containing only consumed fields. |
| Pull changes | `Promise<PullResponse>` | Decodes entities and operations, verifies ordered changes and cursor consistency before returning. |
| Sync mutations and logout | `Promise<void>` | Consumers use HTTP acknowledgement, rather than arbitrary JSON response fields. Logout keeps its existing best-effort policy. |

The pull engine's dependency now returns `PullResponse`, so unvalidated JSON
never reaches transaction reconciliation. The private request helper takes a
decoder and returns its actual output. This avoids the misleading pattern
`request<T>()` followed by `json as T`, which supplies a type promise without
checking the response.

`unknown` is confined to raw JSON, caught errors, and legacy-normalization
inputs until they are checked. Those values have no reliable TypeScript shape
when they arrive. Removing that boundary type with a cast would weaken the
strongly typed API rather than improve it. DTOs, persisted rows, form inputs,
and view projections are different contracts and should stay distinguishable.

This follows the type-design and runtime-validation guidance in
[Effective TypeScript](https://effectivetypescript.com/). Types define what a
caller may rely on; validation makes that promise true for external values.

## Branded values

The linked [lap-timer time module](https://github.com/isel-leic-daw/s2627i-51d-51n/blob/main/code/js/react-intro/src/example-lap-timer/time.ts)
uses distinct numeric brands for instants and durations. DriveCost now applies
that distinction in `domain/time.ts` and retry scheduling. Here `Instant` means
Unix epoch milliseconds, since retry dates survive app restarts; the example's
`performance.now()` reference is appropriate for elapsed timing inside a run.

Checked constructors are the only places that assert the brands. Instants must
be representable Unix timestamps; durations must be finite and non-negative.
`addDuration(Instant, Duration)` returns an `Instant`. Type assertions in tests
verify the units cannot be interchanged at this API, while runtime tests cover
invalid construction and retry dates.

The [Learning TypeScript branded-types article](https://www.learningtypescript.com/articles/branded-types)
also explains the limits: branding does not validate input by itself, and
native arithmetic can still mix branded numbers. Checked constructors and typed
domain operations are needed together. Branding every string or number would
add conversions without necessarily preventing a meaningful mistake.

The most useful next candidates are vehicle IDs versus entry IDs, client IDs
versus cloud user IDs, and calendar dates versus ISO instants. Money branding
needs an explicit currency and rounding policy first; it cannot fix floating
point arithmetic by adding a phantom property.

## Interaction improvements

- SignIn and CreateAccount each own their reducer. SignIn no longer carries a
  confirmation field belonging to CreateAccount.
- Charging, odometer updates, and both vehicle forms now have local
  editing/saving/saved states and a shared submission guard hook. Pending input
  is stable; failures retain it and allow retry. Vehicle-form persistence
  failures now produce recoverable user-facing messages.
- Fuel, maintenance, ownership-expense, and recurring editors have local typed
  reducers backed by the reusable editor hook.
- Settings distinguishes loading, a successfully loaded local-only dataset, and
  an account-load failure with a retry action. These states previously all
  looked like an absent owner.

Reducers do not call the database or clock. Date defaults and model conversion
remain outside transitions. SQLite schemas, stable sync identities, metrics,
and route names have not changed.

## Completed consistency follow-up

The five agreed correctness findings are addressed:

- Refresh rejects credentials only on an explicit refresh-endpoint 401. Network,
  timeout, malformed-response, and server errors retain the session and remain
  retryable. Sync no longer clears a refresh credential based on an access-token
  rejection. Secure writes serialize; rotated credentials retry storage before
  another rotation, and old refresh results cannot replace a later sign-in.
- Fuel, maintenance, payments, and recurring editors share a typed saving
  lifecycle and a synchronous submission guard. Pending input stays fixed;
  errors restore the same edit, and vehicle changes invalidate old completions.
  Shared delete actions also guard concurrent submissions.
- All entry deletions and vehicle deletion include their resulting snapshots
  in the mutation/outbox transaction. A failed read rolls back the deletion,
  and successful local completion does not await sync.
- Entry caches retain vehicle ownership, guard reads by request generation, and
  invalidate older reads after writes. Loading, error, and successfully empty
  results are distinct. Home and History do not show incomplete records as
  empty or zero-cost results. Other entry screens provide a retry notice.
  Remote pulls refresh all five active-vehicle entry caches.
- Guest upgrades verify and preserve the owner ID, atomically update its mode,
  and publish a credential-free account projection. Settings reloads on focus
  and account changes, with stale-read protection. Email survives persistence,
  restoration, and refresh. A matching registered session repairs a legacy
  guest-mode binding on initialization.

These changes use the same boundary-validation, explicit-state, and transaction
patterns discussed above. No schema, cost metric, sync identity, or dependency
changed. General account switching remains separate product work. The subsequent
DC-210.4.2 implementation adds explicit choices for unbound device data.

A rotated refresh secret cannot be made durable when secure storage itself is
unavailable. The replacement stays recoverable in memory while the app runs;
closing the app before storage succeeds can still require signing in again.

## Remaining follow-ups

- Exercise the offline/restart/account-upgrade journey on a device, then the
  existing two-device sync and migration release checks.
- Account recovery and email verification remain release-readiness work in the
  development roadmap, beyond this mobile consistency pass.
- The unused `code/mobile/store/vehicleStore.ts` prototype and
  `CostSummaryCards.tsx` can be removed after confirming their retirement.

## Completed save and record-contract follow-up

- Fuel, charging, and maintenance saves use one transaction for entry write,
  monotonic odometer advancement, parent-first outbox jobs, and the snapshots
  needed to update stores. Fuel and maintenance edits preserve their original
  identities. The screen no longer calls a separate odometer mutation.
- Batch and single-job local mutations resolve after commit without waiting for
  sync. A serial scheduler coalesces active requests and runs a follow-up for
  newly committed writes. Failed jobs in backoff prevent a false up-to-date
  status. The durable queue and manual retry paths remain in place.
- All six persisted mobile record types require local and client identity.
  Creation inputs cannot supply either; updates require the local ID, and the
  repository preserves its stored client ID. Inserts return SQLite-assigned
  identity. Legacy normalization remains separate from proving a persisted
  identity, and optional SQL metadata nulls are normalized on reads.
- Creation and update use cases return saved records. Snapshot reads are inside
  the commit boundary for these saves, including ownership expenses, recurring
  commitments, vehicle profiles, and odometer-only updates. No new schema or
  identity migration was needed.
- Domain cost sums accept only the amount fields they need. Persisted identity
  is required where it identifies a saved record, not invented for calculations.

Real in-memory SQLite tests execute production repositories and store use cases
with injected failures in entry/odometer writes, both outbox inserts, and
snapshot reads. They verify complete rollback and retry without duplicate
records, preserved update identity, and no odometer regression. Tests also
cover pending/failed sync without delaying local completion, scheduler
coalescing, completion races, backoff status, and typed record contracts.
Mobile development checks now require Node 22.13+ for the built-in SQLite
regression-test adapter; CI already uses Node 22. No new dependency was added.

## Tooling and dependency follow-up

All three packages now declare `typescript: ^7.0.2`; the lockfiles resolve
7.0.2. Mobile also declares `oxlint-tsgolint` 7.0.2004 and enables type-aware
linting. The lint script builds contracts first so shared declarations resolve.
Unsafe assignment/call/member/argument/return checks apply to production source.
Store callback types are function properties, matching their intentional
`this`-free implementation. Previously unhandled Garage, fuel, and maintenance
loads now report recoverable errors.

The added helper follows [Oxlint's type-aware setup](https://oxc.rs/docs/guide/usage/linter/type-aware).
The earlier lint setup only checked syntax-level rules; installing the helper
without enabling type-aware checks would not have added this protection.

Prettier and Node types are explicit development dependencies. The unused
`expo-status-bar` package was removed, along with inactive Yarn `resolutions`
from this npm-managed project. Mobile source is formatted using the user's
current Prettier settings. React, React Native, Expo, native storage, navigation,
icons, safe areas, screens, Zustand, and the contracts' runtime decoders remain
runtime dependencies because the installed application uses them.

Expo 55's CLI expects TypeScript's old JavaScript compiler API when processing
tsconfig aliases. Android export initially failed after the upgrade at that
call. TypeScript 7's changed API surface is documented in the
[TypeScript 7 release announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
This app has no tsconfig aliases, so `experiments.tsconfigPaths` is explicitly
false, using Expo's [documented setting](https://docs.expo.dev/guides/typescript/).
A scoped npm override aligns `@expo/require-utils`' old optional TypeScript
peer requirement with the chosen compiler. The dependency graph and Android
export then passed. Revisit that compatibility choice if adding tsconfig
aliases or upgrading the Expo SDK; it does not claim universal SDK 55 support
for TypeScript 7's programmatic API.

## Verification and limits

Mobile type-aware lint, type checking, style checking, and 277 tests across 53 test files passed under TypeScript 7.0.2. Added
coverage checks local reducer submission/recovery, account-load states, branded
time types, retry scheduling, DTO output types, malformed pull responses, and
empty mutation acknowledgements. Existing domain, repository, migration, and
navigation tests still pass. A simulator interaction pass was not performed.

The compiler-only upgrade also passes contracts build/type checking and backend
source/test type checking with 12 tests passing and seven Postgres tests skipped.
No backend or shared-contract domain implementation changed in this follow-up.
An Android bundle export passes; the app was not installed on a device.


## DC-210.4.2 — 12 October 2026

Existing-account access now includes an isolated local-data choice, guarded
adoption, preflight plus transactional replacement, and durable local sign-out.
The recent consistency fixes remain intact. The full flow, safety decisions,
changed modules, verification, and deliberately deferred risks are documented in
[DC-210.4.2 account access](dc-210-4-2-account-access.md).

The safety extension is narrowly scoped: dedicated create-only adoption uploads
close the preflight/push collision race without changing normal sync ownership
or adding a general conflict-resolution framework. Initial snapshots acknowledge
older legitimate upserts only after delivery, preserving later mutations.
SQLite intent markers handle interruption across its boundary with SecureStore.

Verification for DC-210.4.2 passes with 315 mobile tests across 56 files,
13 backend tests, and eight real-Postgres integration tests. Required lint,
type/build, formatting, and diff checks pass; Android export also passes.
