# DriveCost

DriveCost is a local-first mobile app for understanding the recorded costs of
vehicle ownership.

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
- edit fuel and maintenance entries while preserving their sync identity
- delete fuel and maintenance entries, including while offline
- record entry dates and review a complete vehicle history
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
cd code/contracts
npm install
npm run build
cd ../mobile
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
cd code/contracts && npm run typecheck
cd ../mobile && npm run typecheck && npm test
cd ../backend && npm run typecheck && npm test
```

GitHub Actions runs the same commands on pull requests and changes to `main`.

## Running The Backend

From [`code/backend`](/Users/goncalofrutuoso/Developer/drivecost/code/backend):

```bash
cd code/contracts
npm install
npm run build
cd ../backend
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
- `DELETE /fuel-entries/:clientId`
- `DELETE /maintenance-entries/:clientId`
- `GET /sync?after=:cursor`

## Docs

Start with [`docs/README.md`](/Users/goncalofrutuoso/Developer/drivecost/docs/README.md)
for the authoritative documentation map.
