import { FastifyInstance } from "fastify";
import {
  readDatabase,
  toPublicSyncedRecord,
  upsertByClientId,
  writeDatabase,
} from "../../lib/fileDatabase";
import {
  FuelEntrySyncInput,
  MaintenanceEntrySyncInput,
  fuelEntrySyncSchema,
  maintenanceEntrySyncSchema,
} from "./schemas";

export async function registerEntryRoutes(app: FastifyInstance) {
  app.post<{ Body: FuelEntrySyncInput }>(
    "/fuel-entries",
    { onRequest: [app.authenticate], schema: { body: fuelEntrySyncSchema } },
    async (request, reply) => {
      const database = readDatabase();
      const ownsVehicle = database.vehicles.some(
        (vehicle) =>
          vehicle.userId === request.user.sub &&
          vehicle.clientId === request.body.vehicleClientId,
      );

      if (!ownsVehicle) {
        return reply.code(409).send({ error: "vehicle_not_found" });
      }

      const record = upsertByClientId(
        database.fuelEntries,
        "fuel",
        request.user.sub,
        request.body,
      );
      writeDatabase(database);

      reply.code(201);
      return { data: toPublicSyncedRecord(record) };
    },
  );

  app.post<{ Body: MaintenanceEntrySyncInput }>(
    "/maintenance-entries",
    { onRequest: [app.authenticate], schema: { body: maintenanceEntrySyncSchema } },
    async (request, reply) => {
      const database = readDatabase();
      const ownsVehicle = database.vehicles.some(
        (vehicle) =>
          vehicle.userId === request.user.sub &&
          vehicle.clientId === request.body.vehicleClientId,
      );

      if (!ownsVehicle) {
        return reply.code(409).send({ error: "vehicle_not_found" });
      }

      const record = upsertByClientId(
        database.maintenanceEntries,
        "maintenance",
        request.user.sub,
        request.body,
      );
      writeDatabase(database);

      reply.code(201);
      return { data: toPublicSyncedRecord(record) };
    },
  );
}
