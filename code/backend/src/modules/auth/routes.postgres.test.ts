import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../app";
import { PostgresRepository } from "../../platform/persistence/postgresRepository";

const databaseUrl = process.env.DATABASE_URL;
const testSecret = "test-secret-that-is-at-least-thirty-two-characters";

test(
  "Postgres persists idempotent, user-scoped vehicle sync",
  { skip: !databaseUrl },
  async () => {
    const app = await createApp({
      jwtSecret: testSecret,
      logger: false,
      repository: new PostgresRepository(databaseUrl!),
    });
    const email = `postgres-${randomUUID()}@drivecost.test`;

    try {
      const registration = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "correct-horse-battery-staple" },
      });
      assert.equal(registration.statusCode, 201);
      const accessToken = registration.json().accessToken as string;

      const vehicle = {
        clientId: "vehicle_integration_1",
        brand: "Toyota",
        model: "Corolla",
        year: 2022,
        ownershipStartMileage: 12000,
        trackingStartMileage: 15000,
        currentOdometer: 18000,
      };

      const created = await app.inject({
        method: "POST",
        url: "/vehicles",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: vehicle,
      });
      assert.equal(created.statusCode, 201);

      const updated = await app.inject({
        method: "POST",
        url: "/vehicles",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { ...vehicle, currentOdometer: 18500 },
      });
      assert.equal(updated.statusCode, 201);
      assert.equal(updated.json().data.id, created.json().data.id);

      const vehicles = await app.inject({
        method: "GET",
        url: "/vehicles",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(vehicles.statusCode, 200);
      const [storedVehicle] = vehicles.json().data as Array<Record<string, unknown>>;
      assert.equal(storedVehicle.clientId, vehicle.clientId);
      assert.equal(storedVehicle.brand, vehicle.brand);
      assert.equal(storedVehicle.currentOdometer, 18500);
      assert.equal(storedVehicle.id, created.json().data.id);
      assert.match(storedVehicle.createdAt as string, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(storedVehicle.updatedAt as string, /^\d{4}-\d{2}-\d{2}T/);

      const firstPull = await app.inject({
        method: "GET",
        url: "/sync?after=0",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(firstPull.statusCode, 200);
      const firstPullBody = firstPull.json();
      assert.equal(firstPullBody.data.length, 2);
      assert.equal(typeof firstPullBody.nextCursor, "number");
      assert.equal(firstPullBody.data.at(-1).payload.currentOdometer, 18500);
      assert.equal(firstPullBody.data.at(-1).payload.clientId, vehicle.clientId);

      const secondPull = await app.inject({
        method: "GET",
        url: `/sync?after=${firstPullBody.nextCursor}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(secondPull.statusCode, 200);
      assert.deepEqual(secondPull.json(), {
        data: [],
        nextCursor: firstPullBody.nextCursor,
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "Postgres propagates vehicle and entry changes between two device cursors",
  { skip: !databaseUrl },
  async () => {
    const app = await createApp({
      jwtSecret: testSecret,
      logger: false,
      repository: new PostgresRepository(databaseUrl!),
    });
    const email = `two-device-${randomUUID()}@drivecost.test`;

    try {
      const registration = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "correct-horse-battery-staple" },
      });
      assert.equal(registration.statusCode, 201);
      const accessToken = registration.json().accessToken as string;
      const headers = { authorization: `Bearer ${accessToken}` };

      const vehicle = {
        clientId: "vehicle_two_device_1",
        brand: "Honda",
        model: "Civic",
        year: 2021,
        ownershipStartMileage: 5_000,
        trackingStartMileage: 7_000,
        currentOdometer: 12_000,
      };

      const createdVehicle = await app.inject({
        method: "POST",
        url: "/vehicles",
        headers,
        payload: vehicle,
      });
      assert.equal(createdVehicle.statusCode, 201);

      const createdFuelEntry = await app.inject({
        method: "POST",
        url: "/fuel-entries",
        headers,
        payload: {
          clientId: "fuel_two_device_1",
          vehicleClientId: vehicle.clientId,
          date: "2026-07-26T08:00:00.000Z",
          liters: 42.5,
          price: 75.2,
          odometer: 12_100,
        },
      });
      assert.equal(createdFuelEntry.statusCode, 201);

      const createdMaintenanceEntry = await app.inject({
        method: "POST",
        url: "/maintenance-entries",
        headers,
        payload: {
          clientId: "maintenance_two_device_1",
          vehicleClientId: vehicle.clientId,
          date: "2026-07-26T09:00:00.000Z",
          type: "Oil service",
          description: "Oil and filter replacement",
          cost: 95,
          odometer: 12_150,
        },
      });
      assert.equal(createdMaintenanceEntry.statusCode, 201);

      const deviceBInitialPull = await app.inject({
        method: "GET",
        url: "/sync?after=0",
        headers,
      });
      assert.equal(deviceBInitialPull.statusCode, 200);
      const initialBody = deviceBInitialPull.json();
      assert.deepEqual(
        initialBody.data.map((change: { entityType: string }) => change.entityType),
        ["vehicle", "fuel_entry", "maintenance_entry"],
      );
      assert.equal(initialBody.data[0].payload.clientId, vehicle.clientId);
      assert.equal(initialBody.data[1].payload.vehicleClientId, vehicle.clientId);
      assert.equal(initialBody.data[2].payload.vehicleClientId, vehicle.clientId);

      const deviceBUpdate = await app.inject({
        method: "POST",
        url: "/vehicles",
        headers,
        payload: { ...vehicle, currentOdometer: 12_500 },
      });
      assert.equal(deviceBUpdate.statusCode, 201);
      assert.equal(deviceBUpdate.json().data.id, createdVehicle.json().data.id);

      const deviceAIncrementalPull = await app.inject({
        method: "GET",
        url: `/sync?after=${initialBody.nextCursor}`,
        headers,
      });
      assert.equal(deviceAIncrementalPull.statusCode, 200);
      assert.equal(deviceAIncrementalPull.json().data.length, 1);
      assert.equal(deviceAIncrementalPull.json().data[0].payload.clientId, vehicle.clientId);
      assert.equal(deviceAIncrementalPull.json().data[0].payload.currentOdometer, 12_500);

      const vehicles = await app.inject({ method: "GET", url: "/vehicles", headers });
      assert.equal(vehicles.statusCode, 200);
      assert.equal(vehicles.json().data.length, 1);
      assert.equal(vehicles.json().data[0].currentOdometer, 12_500);
    } finally {
      await app.close();
    }
  },
);
