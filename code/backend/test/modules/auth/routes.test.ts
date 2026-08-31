import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../../src/app";

const testSecret = "test-secret-that-is-at-least-thirty-two-characters";

test("registered users can sync only validated, owned vehicle data", async () => {
  const app = await createApp({ jwtSecret: testSecret, logger: false });
  const email = `test-${randomUUID()}@drivecost.test`;

  try {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "correct-horse-battery-staple" },
    });

    assert.equal(registration.statusCode, 201);
    const accessToken = registration.json().accessToken as string;
    assert.ok(accessToken);

    const unauthorized = await app.inject({
      method: "POST",
      url: "/vehicles",
      payload: {},
    });
    assert.equal(unauthorized.statusCode, 401);

    const invalidVehicle = await app.inject({
      method: "POST",
      url: "/vehicles",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { clientId: "vehicle_1" },
    });
    assert.equal(invalidVehicle.statusCode, 400);

    const createdVehicle = await app.inject({
      method: "POST",
      url: "/vehicles",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientId: "vehicle_1",
        brand: "Toyota",
        model: "Corolla",
        year: 2022,
        ownershipStartMileage: 12000,
        trackingStartMileage: 15000,
        currentOdometer: 18000,
      },
    });

    assert.equal(createdVehicle.statusCode, 201);
    assert.equal(createdVehicle.json().data.clientId, "vehicle_1");
    assert.equal("userId" in createdVehicle.json().data, false);

    const vehicles = await app.inject({
      method: "GET",
      url: "/vehicles",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(vehicles.statusCode, 200);
    assert.equal(vehicles.json().data.length, 1);

    const changes = await app.inject({
      method: "GET",
      url: "/sync?after=0",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(changes.statusCode, 200);
    assert.equal(changes.json().data[0].clientId, "vehicle_1");
    assert.equal(changes.json().data[0].payload.clientId, "vehicle_1");
  } finally {
    await app.close();
  }
});
