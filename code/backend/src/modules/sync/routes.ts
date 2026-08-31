import { FastifyInstance } from 'fastify';
import { DriveCostRepository } from '../../platform/persistence/repository';

interface SyncQuery {
    after?: number;
    limit?: number;
}

const INITIAL_CURSOR = 0;
const MINIMUM_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 100;
const MAXIMUM_PAGE_SIZE = 500;

const syncQuerySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        after: { type: 'integer', minimum: INITIAL_CURSOR, default: INITIAL_CURSOR },
        limit: { type: 'integer', minimum: MINIMUM_PAGE_SIZE, maximum: MAXIMUM_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
    },
} as const;

export async function registerSyncRoutes(app: FastifyInstance, repository: DriveCostRepository) {
    app.get<{ Querystring: SyncQuery }>(
        '/sync',
        { onRequest: [app.authenticate], schema: { querystring: syncQuerySchema } },
        async (request) => {
            const after = request.query.after ?? INITIAL_CURSOR;
            const limit = request.query.limit ?? DEFAULT_PAGE_SIZE;
            const changes = await repository.listChanges(request.user.sub, after, limit);
            return { data: changes, nextCursor: changes.at(-1)?.sequence ?? after };
        },
    );
}
