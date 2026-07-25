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
      assert.equal(firstPullBody.data.at(-1).payload.currentOdometer, 18500);

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
