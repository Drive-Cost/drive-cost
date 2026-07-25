import { FastifyInstance } from "fastify";
import { DriveCostRepository, toPublicRecord } from "../../platform/persistence/repository";
import {
  FuelEntrySyncInput,
  MaintenanceEntrySyncInput,
  fuelEntrySyncSchema,
  maintenanceEntrySyncSchema,
} from "./schemas";

export async function registerEntryRoutes(app: FastifyInstance, repository: DriveCostRepository) {
  app.post<{ Body: FuelEntrySyncInput }>(
    "/fuel-entries",
    { onRequest: [app.authenticate], schema: { body: fuelEntrySyncSchema } },
    async (request, reply) => {
      const ownsVehicle = await repository.entityExists(
        request.user.sub, "vehicle", request.body.vehicleClientId,
      );

      if (!ownsVehicle) {
        return reply.code(409).send({ error: "vehicle_not_found" });
      }

      const record = await repository.upsertEntity(
        request.user.sub, "fuel_entry", request.body,
      );

      reply.code(201);
      return { data: toPublicRecord(record) };
    },
  );

  app.post<{ Body: MaintenanceEntrySyncInput }>(
    "/maintenance-entries",
    { onRequest: [app.authenticate], schema: { body: maintenanceEntrySyncSchema } },
    async (request, reply) => {
      const ownsVehicle = await repository.entityExists(
        request.user.sub, "vehicle", request.body.vehicleClientId,
      );

      if (!ownsVehicle) {
        return reply.code(409).send({ error: "vehicle_not_found" });
      }

      const record = await repository.upsertEntity(
        request.user.sub, "maintenance_entry", request.body,
      );

      reply.code(201);
      return { data: toPublicRecord(record) };
    },
  );
}
