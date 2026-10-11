# DriveCost Architecture

## Overview

DriveCost is a React Native mobile application built with Expo and TypeScript.

The architecture prioritizes:

- simplicity
- fast development
- maintainability
- offline-first design

The app stores data locally using SQLite and can synchronize account data
through an optional backend without making local use depend on the network.

The repository contains a backend module under `code/backend/`. It is the
account and sync boundary; future subscription and curated-domain-data work
belongs there while the mobile database remains immediately usable offline.

---

# Technology Stack

Frontend

- React Native
- Expo
- TypeScript

State Management

- Zustand

Database

- SQLite (local-first)

Navigation

- React Navigation

Charts (future)

- react-native-svg
- victory-native

---

# Repository Structure

```text
code/
  contracts/              Shared, versioned HTTP and sync protocol types
  mobile/                 Expo application
  backend/                Fastify API and sync service
  database/               Shared database notes and future production migrations
docs/                     Product, architecture, and delivery decisions
```

## Mobile Organization

Keep React Navigation for now. The current application is small, and changing
to Expo Router would move files without improving the offline data model. Route
groups such as `(auth)` and `(tabs)` remain a valid future migration if deep
links or web parity make file-based routes valuable.

Mobile UI is organized by screen. This is the current convention, replacing
technical screen lists and the earlier partial feature-slice experiment:

```text
code/mobile/src/
  screens/
    Fuel/
      Screen.tsx
      reducer.ts          State, Action, Input, reduce
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
  components/             UI genuinely shared by multiple screens
    entry/
    vehicle/
  hooks/                  Reusable React hooks
    useEntryEditor/
      useEntryEditor.ts
      reducer.ts
    useSubmissionGuard.ts
  domain/                 Pure validation, units, and identity rules
  models/                 Mobile persistence models
  services/               Use cases, presentation projections, and API decoding
  store/                  Zustand use-case coordination and cached data
  database/               SQLite bootstrap and repositories
  navigation/             Typed routes and navigator composition
  shared/ui/              Design tokens
```

Every screen owns one directory. A screen-specific UI component belongs in its
screen's `components/` directory. `components/` at the source root contains UI
shared by multiple screens. Hooks belong under `hooks/`; non-UI error mapping
and protocol decoding belong in services. Navigation imports actual screen
implementations directly, with no duplicate re-export screen files.

### Screen state and actions

A screen-local `reducer.ts` exports `State`, `Action`, and `reduce`. It can also
export `Input` and `initialState` where useful. The folder supplies context, so
reducer symbols do not repeat the screen name. Use discriminated unions for
related state and asynchronous phases; field actions use the concrete input's
keys. Reducers stay pure: clocks, repositories, navigation, and network calls
are outside them.

The entry editor hook shares creation/edit selection and error transitions.
Fuel, maintenance, and ownership-expense reducers specialize those transitions
with their concrete entry/input types. Recurring costs are a private sub-editor
of OwnershipExpenses. Their reducer stays beside their UI component. Sharing
identical interaction mechanics does not merge distinct fuel, charging,
payment, and recurring-cost semantics.

Read-only screens derive projections from Zustand and domain services rather
than copying authoritative data into a reducer. They need no empty
`reducer.ts`. A single independent disclosure toggle can remain `useState`.
Guard submissions synchronously as well as through a saving state: a disabled
button does not protect the interval before React renders it.

### Type and protocol boundaries

Prefer `type` aliases to `interface` declarations in mobile code; lint enforces
this convention. Service callers receive concrete validated DTOs, including
`SessionResponse` and `PullResponse`, or `void` when only an acknowledgement is
consumed. Private JSON decoders and caught errors use `unknown` until checked.
A generic response type or a cast alone must never substitute for validation.

Use branded values where confusing units or identities can cause incorrect
results. `domain/time.ts` distinguishes Unix `Instant` values from elapsed
`Duration` values; retry scheduling consumes an `Instant` and adds a validated
duration. Brands are created in checked constructors. Stored JSON remains
unchanged. Broader money, mileage, and identity branding should be designed at
their parsing and repository boundaries before changing persisted model types.

### Local mutation completion and record identity

A successful mobile save means its SQLite transaction committed. Its network
request is a best-effort wake-up after commit and is never awaited by the local
mutation. `services/sync/localMutation.ts` provides a typed batch operation for
multiple outbox jobs and a committed result. Sync passes run serially, coalesce
requests, and repeat when a write arrives during an active pass. Failed jobs
waiting for backoff keep their recoverable error state.

Fuel, charging, and maintenance creation—and existing fuel/maintenance edits—
use `services/entries/recordEntry.ts`. Their entry write, monotonic vehicle
odometer advancement, parent-first outbox jobs, and store snapshots share one
transaction. The screens submit the event once, without a second odometer
mutation. Snapshot reads happen before commit so a failed reload cannot turn a
committed create into an apparent failed save. Ownership expenses and recurring
commitments retain their existing independent semantics.

Mobile `Vehicle`, `FuelEntry`, `ChargingEntry`, `MaintenanceEntry`,
`ExpenseEntry`, and `RecurringExpense` types represent persisted records with
required `id` and `clientId`. Named `Create…Input` types prohibit supplied
identities. `Update…Input` types require a local ID; repositories load the
stable client ID rather than accepting a replacement. Insert inputs have a
use-case-generated client ID, and SQLite assigns their local ID. Repository
reads validate identities and normalize optional SQL nulls before returning
persisted records. Existing migrations still populate legacy identities; this
change adds no schema migration or identity regeneration.

Create/update use cases return the committed record. Calculations that need
only amounts accept those fields without requiring invented persistence IDs.
Entity ID branding remains a separate decision based on concrete mix-up risks.

### Development tooling

TypeScript `^7.0.2` is the compiler for mobile, contracts, and backend. Mobile
Oxlint uses `oxlint-tsgolint` for type-aware correctness checks; production
source also rejects unsafe `any` propagation. Build contracts before linting to
make their declarations available. Prettier follows `code/.prettierrc`.

Expo 55's tsconfig alias processing depends on the old compiler API. This app
uses relative imports, so `app.json` disables `experiments.tsconfigPaths`.
The scoped `@expo/require-utils` TypeScript peer override is verified by a
bundle export. Revisit it with an SDK upgrade or before adding tsconfig aliases.
Mobile development checks require Node 22.13+; SQLite regression tests use its
built-in in-memory SQLite API through an adapter matching the Expo repository
operations. The existing CI Node 22 setup meets this minimum.
Development tools and ambient type packages belong in `devDependencies`;
modules used by the application or required native integration stay in
`dependencies`.

## Backend Organization

Use a modular, layered shape inspired by the strong separation in Gomoku-Web,
but keep it proportional to DriveCost's size:

```text
code/backend/src/
  app.ts                  Fastify composition root
  server.ts               Process startup only
  config/                 Environment parsing and runtime configuration
  platform/               Database connection, migrations, HTTP middleware
  modules/
    auth/                 Routes, schemas, service, repository, types
    vehicles/             Routes, schemas, service, repository, types
    entries/              Routes, schemas, service, repository, types
    sync/                 Change feed, cursors, conflict policy
```

The composition root creates the vehicle and entry services and injects them
into routes. Entry services query parent availability through the vehicle
service contract; persistence adapters still enforce transaction and tombstone
invariants at write time.

Route handlers parse requests and map responses. Services enforce use cases and
authorization. Repositories contain persistence queries only. Modules must not
reach into another module's repository directly; they collaborate through a
service contract. This keeps authentication and sync testable as the JSON file
adapter is replaced by Postgres.

---

# Layer Responsibilities

## Screens

Responsible for UI and user interaction.

Examples:

- GarageScreen
- DashboardScreen
- FuelScreen
- MaintenanceScreen

---

## Components

Reusable UI pieces.

Examples:

- VehicleCard
- CostSummary
- AddButton

---

## Persistence

Responsible for all SQLite queries.

Example files:

- db.ts
- vehicleRepository.ts
- fuelRepository.ts
- maintenanceRepository.ts

---

## Domain And Services

Contains business logic and calculations.

Examples:

- cost calculations
- analytics
- projections

---

## Store

Global state management using Zustand.

Responsible for:

- current vehicle
- cached data
- UI state

---

# Data Flow

User Action

↓

Screen

↓

Store

↓

Database

↓

UI update

Synchronized flow:

User Action

↓

Screen

↓

Store

↓

Local Database

↓

Sync Layer

↓

Backend API

## Quality Boundaries

- Models and validation are shared within the mobile app only; do not import
  mobile persistence models into the backend.
- API request, response, cursor, and Problem Details contracts live in
  `code/contracts`. The package owns protocol values and runtime decoding;
  mobile and backend own their own persistence models.
- Database migrations are forward-only and tested against a representative
  prior schema.
- The backend treats all mobile payloads as untrusted, even if their TypeScript
  shapes currently look similar.
