import { FastifyInstance } from "fastify";
import {
  readDatabase,
  upsertByClientId,
  writeDatabase,
} from "../../lib/fileDatabase";
import {
  SyncedFuelEntryRecord,
  SyncedMaintenanceEntryRecord,
} from "../../types/domain";

export async function registerEntryRoutes(app: FastifyInstance) {
  app.post<{ Body: Record<string, unknown> }>(
    "/fuel-entries",
    async (request, reply) => {
      const database = readDatabase();
      const record = upsertByClientId<SyncedFuelEntryRecord>(
        database.fuelEntries,
        "fuel",
        request.body,
      );
      writeDatabase(database);

      reply.code(201);
      return { data: record };
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    "/maintenance-entries",
    async (request, reply) => {
      const database = readDatabase();
      const record = upsertByClientId<SyncedMaintenanceEntryRecord>(
        database.maintenanceEntries,
        "maintenance",
        request.body,
      );
      writeDatabase(database);

      reply.code(201);
      return { data: record };
    },
  );
}
