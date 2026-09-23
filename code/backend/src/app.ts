import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { FileRepository } from './platform/persistence/fileRepository';
import { DriveCostRepository } from './platform/persistence/repository';
import { registerHealthRoutes } from './modules/health/routes';
import { registerAuthRoutes } from './modules/auth/routes';
import { registerVehicleRoutes } from './modules/vehicles/routes';
import { registerEntryRoutes } from './modules/entries/routes';
import { registerSyncRoutes } from './modules/sync/routes';
import {
    HttpProblem,
    PROBLEM_DETAILS_MEDIA_TYPE,
    toHttpProblem,
    toProblemDetails,
} from './platform/http/problemDetails';

interface AppOptions {
    jwtSecret: string;
    logger?: boolean;
    repository?: DriveCostRepository;
}

export const JWT_ISSUER = 'https://api.drivecost.app';
export const JWT_AUDIENCE = 'drivecost-mobile';

export async function createApp({ jwtSecret, logger = true, repository }: AppOptions) {
    const persistence = repository ?? new FileRepository();
    await persistence.initialize();

    const app = Fastify({ logger });

    await app.register(fastifyJwt, {
        secret: jwtSecret,
        sign: { algorithm: 'HS256', iss: JWT_ISSUER, aud: JWT_AUDIENCE, expiresIn: '15m' },
        verify: { algorithms: ['HS256'], allowedIss: JWT_ISSUER, allowedAud: JWT_AUDIENCE },
    });
    await app.register(fastifyRateLimit, { global: false, keyGenerator: (request) => request.ip });

    app.decorate('authenticate', async (request) => {
        await request.jwtVerify();
    });

    app.setErrorHandler((error, request, reply) => {
        if (!(error instanceof HttpProblem)) {
            request.log.error(error);
        }

        const httpProblem = toHttpProblem(error);
        const response = toProblemDetails(httpProblem, request.url);

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
