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

## Running The Backend

From [`code/backend`](/Users/goncalofrutuoso/Developer/drivecost/code/backend):

```bash
npm start
```

Current backend endpoints:

- `GET /health`
- `POST /auth/guest`
- `POST /vehicles`
- `POST /fuel-entries`
- `POST /maintenance-entries`

## Product Direction

DriveCost is intentionally backend-free for the current MVP.

That makes sense while you are validating:

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

The repository now includes a backend scaffold under
[`code/backend`](/Users/goncalofrutuoso/Developer/drivecost/code/backend) so
you can grow into that architecture without mixing backend planning into the
mobile app.

The current mobile implementation stays offline-first:

- data is always written to local SQLite first
- sync jobs are queued locally
- the app attempts replay when it starts and after new writes
- backend unavailability should not block core usage

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
