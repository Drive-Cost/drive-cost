import { FastifyInstance } from "fastify";
import {
  readDatabase,
  upsertByClientId,
  writeDatabase,
} from "../../lib/fileDatabase";
import { SyncedVehicleRecord } from "../../types/domain";

export async function registerVehicleRoutes(app: FastifyInstance) {
  app.get("/vehicles", async () => {
    const database = readDatabase();
    return { data: database.vehicles };
  });

  app.post<{ Body: Record<string, unknown> }>(
    "/vehicles",
    async (request, reply) => {
      const database = readDatabase();
      const record = upsertByClientId<SyncedVehicleRecord>(
        database.vehicles,
        "vehicle",
        request.body,
      );
      writeDatabase(database);

      reply.code(201);
      return { data: record };
    },
  );
}
