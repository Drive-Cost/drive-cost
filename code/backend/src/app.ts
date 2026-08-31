import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { FileRepository } from './platform/persistence/fileRepository';
import { DriveCostRepository } from './platform/persistence/repository';
import { registerHealthRoutes } from './modules/health/routes';
import { registerAuthRoutes } from './modules/auth/routes';
import { registerVehicleRoutes } from './modules/vehicles/routes';
import { registerEntryRoutes } from './modules/entries/routes';
import { registerSyncRoutes } from './modules/sync/routes';
import { HttpProblem, problem, PROBLEM_DETAILS_MEDIA_TYPE, toProblemDetails } from './platform/http/problemDetails';

interface AppOptions {
    jwtSecret: string;
    logger?: boolean;
    repository?: DriveCostRepository;
}

export async function createApp({ jwtSecret, logger = true, repository }: AppOptions) {
    const persistence = repository ?? new FileRepository();
    await persistence.initialize();

    const app = Fastify({ logger });

    await app.register(fastifyJwt, { secret: jwtSecret });
    app.decorate('authenticate', async (request) => {
        await request.jwtVerify();
    });

    app.setErrorHandler((error, request, reply) => {
        if (hasValidationError(error)) {
            error = problem('invalidRequest');
        }

        if (getErrorStatusCode(error) === 401) {
            error = problem('unauthorized');
        }

        if (!(error instanceof HttpProblem)) {
            request.log.error(error);
        }

        const response = toProblemDetails(error, request.url);
        return reply.code(response.status).type(PROBLEM_DETAILS_MEDIA_TYPE).send(response);
    });

    await registerHealthRoutes(app);
    await registerAuthRoutes(app, persistence);
    await registerVehicleRoutes(app, persistence);
    await registerEntryRoutes(app, persistence);
    await registerSyncRoutes(app, persistence);

    app.addHook('onClose', async () => persistence.close());

    return app;
}

function hasValidationError(error: unknown): error is { validation: unknown } {
    return Boolean(
        error && typeof error === 'object' && 'validation' in error && (error as { validation?: unknown }).validation,
    );
}

function getErrorStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('statusCode' in error)) {
        return undefined;
    }

    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
}
