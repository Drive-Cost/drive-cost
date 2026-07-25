# DriveCost

DriveCost is a local-first mobile app for understanding the true cost of car ownership.

The current app lives in [`code/mobile`](/Users/goncalofrutuoso/Developer/drivecost/code/mobile) and focuses on a practical MVP:

- create and manage vehicles
- track fuel, charging, and maintenance locally
- understand cost per kilometer
- keep a simple timeline of vehicle events
- work offline first with SQLite

## Current State

The mobile app already includes:

- a Garage with active-vehicle selection
- vehicle metadata such as fuel type, engine, power, transmission, and custom label
- separate mileage concepts:
  `ownershipStartMileage`, `trackingStartMileage`, and `currentOdometer`
- local fuel or charging entry tracking
- local maintenance tracking
- a dashboard with summary cards and recent events
- an offline-first sync queue that can replay changes to a backend later

## Tech Stack

- Expo
- React Native
- TypeScript
- Zustand
- SQLite via `expo-sqlite`
- React Navigation

## Project Structure

- [`docs`](/Users/goncalofrutuoso/Developer/drivecost/docs): product and architecture notes
- [`code/mobile`](/Users/goncalofrutuoso/Developer/drivecost/code/mobile): Expo mobile app
- [`code/backend`](/Users/goncalofrutuoso/Developer/drivecost/code/backend): backend scaffold for sync, accounts, and subscriptions
- [`code/database`](/Users/goncalofrutuoso/Developer/drivecost/code/database): early SQL notes

## Running The Mobile App

From [`code/mobile`](/Users/goncalofrutuoso/Developer/drivecost/code/mobile):

```bash
npm install
npm start
```

Then open in Expo Go or a simulator.

To enable authenticated sync during local development, copy
[`code/mobile/.env.example`](/Users/goncalofrutuoso/Developer/drivecost/code/mobile/.env.example)
to `code/mobile/.env` and set the API URL appropriate for the device or
emulator. Without it, DriveCost remains fully local-first.

## Quality Checks

Each module owns its own dependency lockfile and quality commands:

```bash
cd code/mobile && npm run typecheck && npm test
cd ../backend && npm run typecheck && npm test
```

GitHub Actions runs the same commands on pull requests and changes to `main`.

## Running The Backend

From [`code/backend`](/Users/goncalofrutuoso/Developer/drivecost/code/backend):

```bash
npm install
cp .env.example .env
# Set JWT_SECRET to a unique 32+ character value.
npm run build
npm start
```

Current backend endpoints:

- `GET /health`
- `POST /auth/guest`
- `POST /auth/register`
- `POST /auth/login`
- `POST /vehicles`
- `POST /fuel-entries`
- `POST /maintenance-entries`

## Product Direction

DriveCost remains **local-first** while the MVP is validated. The backend
module is an early development scaffold, not a production sync service yet.

The local product loop is still the first validation target:

- whether users actually keep logging entries
- whether the dashboard is useful enough to create habit
- whether the mileage and vehicle model feel trustworthy

A backend becomes valuable when you want:

- cloud sync across devices
- user accounts
- shared or family vehicles
- backup and restore
- subscription billing
- richer domain data ingestion

The repository includes a backend scaffold under
[`code/backend`](/Users/goncalofrutuoso/Developer/drivecost/code/backend) so
you can grow into that architecture without mixing backend planning into the
mobile app.

The current mobile implementation stays offline-first:

- data is always written to local SQLite first
- sync jobs are queued locally
- the app attempts replay when it starts and after new writes
- backend unavailability should not block core usage

## Engineering Baseline

Before product expansion, the next work focuses on correctness and operability:

- durable client-owned IDs for idempotent sync
- schema migrations and indexed local queries
- input validation and domain rules at the app boundary
- automated tests and continuous integration
- authenticated, user-scoped backend sync using a production database

The sequence, architectural decisions, and explicit non-goals are documented in
[`docs/development-roadmap.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/development-roadmap.md)
and [`docs/architecture-decisions.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/architecture-decisions.md).

## Recommended Next Steps

- tailor more calculations for EVs versus combustion vehicles
- add validation around mileage edits and impossible odometer values
- add vehicle detail/history screens
- start implementing backend auth and sync when the local usage loop feels strong

## Docs

Useful starting points:

- [`docs/product-overview.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/product-overview.md)
- [`docs/app-architecture.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/app-architecture.md)
- [`docs/mvp-scope.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/mvp-scope.md)
- [`docs/development-roadmap.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/development-roadmap.md)
- [`docs/architecture-decisions.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/architecture-decisions.md)
