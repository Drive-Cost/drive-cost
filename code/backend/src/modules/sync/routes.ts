import { FastifyInstance } from "fastify";
import { DriveCostRepository } from "../../platform/persistence/repository";

interface SyncQuery {
  after?: number;
  limit?: number;
}

const syncQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    after: { type: "integer", minimum: 0, default: 0 },
    limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
  },
} as const;

export async function registerSyncRoutes(app: FastifyInstance, repository: DriveCostRepository) {
  app.get<{ Querystring: SyncQuery }>(
    "/sync",
    { onRequest: [app.authenticate], schema: { querystring: syncQuerySchema } },
    async (request) => {
      const after = request.query.after ?? 0;
      const limit = request.query.limit ?? 100;
      const changes = await repository.listChanges(request.user.sub, after, limit);
      return {
        data: changes,
        nextCursor: changes.at(-1)?.sequence ?? after,
      };
    },
  );
}
