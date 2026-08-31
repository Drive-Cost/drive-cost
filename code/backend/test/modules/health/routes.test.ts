import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../../../src/app";

test("health endpoint reports a ready backend", async () => {
  const app = await createApp({
    jwtSecret: "test-secret-that-is-at-least-thirty-two-characters",
    logger: false,
  });

  try {
    const response = await app.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.status, "ok");
    assert.equal(payload.service, "drivecost-backend");
    assert.equal(payload.offlineFirst, true);
    assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await app.close();
  }
});
