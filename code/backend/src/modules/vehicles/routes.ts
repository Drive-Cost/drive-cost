import { FastifyInstance } from "fastify";
import {
  readDatabase,
  toPublicSyncedRecord,
  upsertByClientId,
  writeDatabase,
} from "../../lib/fileDatabase";
import { VehicleSyncInput, vehicleSyncSchema } from "./schemas";

export async function registerVehicleRoutes(app: FastifyInstance) {
  app.get("/vehicles", { onRequest: [app.authenticate] }, async (request) => {
    const database = readDatabase();
    return {
      data: database.vehicles
        .filter((vehicle) => vehicle.userId === request.user.sub)
        .map(toPublicSyncedRecord),
    };
  });

  app.post<{ Body: VehicleSyncInput }>(
    "/vehicles",
    { onRequest: [app.authenticate], schema: { body: vehicleSyncSchema } },
    async (request, reply) => {
      if (
        request.body.trackingStartMileage < request.body.ownershipStartMileage ||
        request.body.currentOdometer < request.body.trackingStartMileage
      ) {
        return reply.code(422).send({ error: "invalid_mileage_baseline" });
      }

      const database = readDatabase();
      const record = upsertByClientId(
        database.vehicles,
        "vehicle",
        request.user.sub,
        request.body,
      );
      writeDatabase(database);

      reply.code(201);
      return { data: toPublicSyncedRecord(record) };
    },
  );
}
