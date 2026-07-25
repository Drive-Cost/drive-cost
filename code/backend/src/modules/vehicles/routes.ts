import { FastifyInstance } from "fastify";
import { DriveCostRepository, toPublicRecord } from "../../platform/persistence/repository";
import { VehicleSyncInput, vehicleSyncSchema } from "./schemas";

export async function registerVehicleRoutes(app: FastifyInstance, repository: DriveCostRepository) {
  app.get("/vehicles", { onRequest: [app.authenticate] }, async (request) => {
    return {
      data: (await repository.listEntities(request.user.sub, "vehicle")).map(toPublicRecord),
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

      const record = await repository.upsertEntity(
        request.user.sub, "vehicle", request.body,
      );

      reply.code(201);
      return { data: toPublicRecord(record) };
    },
  );
}
