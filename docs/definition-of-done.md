# DriveCost Definition of Done

A task is not complete because code was generated.

## Required for every task

- Acceptance criteria are satisfied.
- No unrelated refactor was introduced.
- Relevant type checks pass.
- Relevant tests pass.
- New domain behavior has automated tests.
- User-visible errors are actionable.
- Existing offline-first behavior remains intact.
- Existing sync identities remain stable unless the task explicitly changes identity semantics.
- No unnecessary dependency was added.

## Persistence changes

If a task changes persisted data:

- add a forward-only migration
- preserve existing user data
- define defaults/migration semantics explicitly
- test representative prior-schema upgrade behavior where practical
- keep local write + outbox behavior atomic for syncable mutations

## Sync changes

If a task changes sync behavior:

- retries remain idempotent
- operations are safe to replay
- client IDs remain stable
- pull sync remains cursor ordered
- conflict/deletion semantics are explicit
- offline use is not blocked by backend failure

## Calculation changes

If a task changes a displayed metric:

- the metric follows `docs/cost-semantics.md`
- edge cases are tested
- no calculation is duplicated inside UI components
- incomplete data is represented honestly
- provenance remains possible

## UI changes

If a task changes UI:

- primary action is obvious
- irrelevant vehicle-type actions are hidden
- implementation terminology is not exposed
- empty and error states are considered
- accessibility labels/touch targets are reasonable
- existing data can still be edited and deleted where applicable

## Completion report

The implementing agent should report:

1. what changed
2. key design decisions
3. files materially affected
4. tests added/updated
5. verification commands run
6. any known risk or follow-up

Do not claim completion when required verification fails.
