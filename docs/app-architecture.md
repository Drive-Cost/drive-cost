# DriveCost Architecture

## Overview

DriveCost is a React Native mobile application built with Expo and TypeScript.

The architecture prioritizes:

- simplicity
- fast development
- maintainability
- offline-first design

The app stores data locally using SQLite and synchronizes to cloud services in future versions.

The repository contains a backend module under `code/backend/`. It will grow
into the account, sync, subscription, and curated-domain-data boundary while
the mobile database remains immediately usable offline.

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

New mobile code should move toward feature slices as a feature is touched:

```text
code/mobile/src/
  app/                    App bootstrap, providers, and navigation composition
  features/
    vehicles/             Screens, store, local repository, and vehicle rules
    fuel/                 Fuel or charging entry UI and use cases
    maintenance/          Maintenance entry UI and use cases
    dashboard/            Read-only projections and dashboard UI
  shared/
    ui/                   Reusable presentational components and design tokens
    domain/               Cross-feature rules such as money and mileage
    infrastructure/       SQLite bootstrap, sync outbox, and HTTP client
```

Avoid a large mechanical move now. Existing folders continue to work; migrate
them feature-by-feature when adding tests or changing their behavior. A screen
coordinates interaction, a store coordinates a use case, a repository owns
SQLite access, and domain code stays deterministic and UI-independent.

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

Future synchronized flow:

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
