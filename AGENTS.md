# DriveCost Agent Guide

This file defines how coding agents should work in this repository.

## Product Intent

DriveCost is a local-first mobile product for helping people understand and act on the cost of owning a vehicle.

The product should evolve from a simple expense logger into a trustworthy car-ownership intelligence tool. It should explain costs and usage patterns, reduce logging friction, and help users make better ownership decisions.

Read these documents before implementing product work:

- `docs/product-principles.md`
- `docs/cost-semantics.md`
- `docs/definition-of-done.md`
- `docs/product-roadmap.md`
- `docs/app-architecture.md`
- `docs/architecture-decisions.md`
- `docs/development-roadmap.md`

## Product Principles

- Reduce logging friction before adding novelty.
- Explain ownership costs; do not merely record them.
- Never expose implementation concepts to users when a simple product concept exists.
- Prefer trustworthy, explainable calculations over impressive-looking estimates.
- Keep the core product useful without an account or network connection.
- Do not add a feature solely because it is technically interesting.
- Do not claim "true cost" for a metric that excludes material cost categories without clearly labelling the limitation.

## Architecture Invariants

### Mobile

- Expo + React Native + TypeScript remains the current client stack.
- SQLite is the source of truth on device.
- User writes must succeed locally without network access.
- Zustand coordinates application use cases and state; it should not become the home of domain calculations.
- Repositories own SQLite access.
- Domain calculations and validation must be deterministic and UI-independent.
- React Navigation remains in place unless a product requirement justifies changing it.
- When touching a feature, prefer gradual movement toward the feature-slice structure described in `docs/app-architecture.md`; do not perform broad mechanical reorganizations.

### Sync

- Every syncable entity owns a stable opaque `clientId`.
- Local SQLite row IDs are never cloud identity.
- A local mutation and its outbox job must be committed atomically where applicable.
- Sync operations must be idempotent and safe to replay.
- Backend availability must not block core local usage.
- Pull sync uses the existing cursor/change-feed model.
- Deletion semantics must not allow stale offline writes to resurrect deleted data.
- Tokens belong in secure storage, not the local business-data database.

### Backend

- Fastify + TypeScript remains the current backend stack.
- Postgres is the production system of record for synchronized account data.
- HTTP handlers parse/map HTTP concerns.
- Services enforce use cases and authorization.
- Repositories own persistence queries.
- Backend modules must not reach directly into another module's repository.
- Mobile persistence models must not be imported by the backend.
- Shared protocol contracts belong in `code/contracts`.
- Treat every client payload as untrusted even when TypeScript types are shared.

## Engineering Rules

- Prefer the smallest change that correctly solves the task.
- Do not perform unrelated refactors in a feature task.
- Do not introduce a dependency unless the task has a concrete need that cannot be met cleanly with the existing stack.
- Prefer clear duplication to premature abstraction when domain semantics differ.
- Keep business calculations out of React components.
- Keep persistence details out of domain calculations.
- New domain behavior requires tests.
- New persistence schema requires a forward-only migration and migration coverage where practical.
- Preserve existing user data across migrations.
- Errors shown to users should be actionable and product-oriented, not implementation-oriented.
- Normal successful sync should remain unobtrusive; surface sync state when it affects the user or requires action.

## Task Protocol

For every implementation task:

1. Read the issue/task completely, including non-goals.
2. Inspect the relevant existing implementation and tests before editing.
3. State any assumption that materially affects data semantics or UX.
4. Implement only the requested scope.
5. Add or update tests for domain and persistence behavior.
6. Run the relevant verification commands.
7. Update documentation only when behavior, semantics, or architecture changed.
8. Summarize what changed, tests run, and any remaining risk.

If a requirement conflicts with an architecture invariant or cost semantic, do not silently work around it. Call out the conflict and prefer preserving correctness.

## Verification Commands

From the repository root, the main checks are:

```bash
cd code/contracts && npm install && npm run build && npm run typecheck
cd ../mobile && npm install && npm run typecheck && npm test
cd ../backend && npm install && npm run typecheck && npm test
```

For Postgres-backed backend work, also run the repository's Postgres integration-test path when the local environment supports it.

Do not report a task complete if the relevant type checks or tests fail.

## UI Direction

DriveCost should feel like a consumer product, not a database editor.

Prefer:

- concise screens with one primary purpose
- context-aware actions based on vehicle type
- progressive disclosure for advanced vehicle data
- human labels such as "Driven since tracking" instead of internal mileage-model terminology
- a single fast "add" flow for routine logging
- useful empty states that explain what the user gets after entering data

Avoid:

- exposing implementation/debug concepts such as sync internals or mileage model fields in normal product UI
- separate permanent navigation destinations for actions that can be context-aware
- large setup forms before the user experiences value
- dashboards that show metrics without explaining their meaning or provenance

## Product Risk Order

When deciding between work items, optimize in this order unless an issue explicitly overrides it:

1. correctness and trustworthiness of user data
2. logging friction and core-loop usability
3. useful ownership insight and retention
4. beta reliability and operability
5. monetization
6. architectural elegance that has no demonstrated product benefit
