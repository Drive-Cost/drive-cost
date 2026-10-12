import Fastify, { type FastifyServerOptions } from 'fastify';
import { createAccountDeletionService } from './modules/auth/accountDeletion';
import { registerAccountDeletionRoutes } from './modules/auth/accountDeletionRoutes';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { FileRepository } from './platform/persistence/fileRepository';
import { DriveCostRepository } from './platform/persistence/repository';
import { registerHealthRoutes } from './modules/health/routes';
import { registerAuthRoutes } from './modules/auth/routes';
import { registerVehicleRoutes } from './modules/vehicles/routes';
import { registerEntryRoutes } from './modules/entries/routes';
import { createVehicleService } from './modules/vehicles/service';
import { createEntryService } from './modules/entries/service';
import { registerSyncRoutes } from './modules/sync/routes';
import {
    HttpProblem,
    Problems,
    PROBLEM_DETAILS_MEDIA_TYPE,
    toHttpProblem,
    toProblemDetails,
} from './platform/http/problemDetails';

type AppOptions = {
    jwtSecret: string;
    logger?: FastifyServerOptions['logger'];
    repository?: DriveCostRepository;
};

export const JWT_ISSUER = 'https://api.drivecost.app';
export const JWT_AUDIENCE = 'drivecost-mobile';

export async function createApp({ jwtSecret, logger = true, repository }: AppOptions) {
    const persistence = repository ?? new FileRepository();
    await persistence.initialize();

    const app = Fastify({
        logger: logger === false ? false : {
            ...(typeof logger === 'object' ? logger : {}),
            redact: [
                'req.headers.authorization', 'req.body.password', 'req.body.refreshToken', 'req.body.operationSecret',
                'password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'operationSecret',
            ],
            serializers: {
                req: request => ({
                    method: request.method,
                    url: request.url?.split('?')[0],
                    hostname: request.hostname,
                    remoteAddress: request.ip,
                }),
            },
        },
    });

    await app.register(fastifyJwt, {
        secret: jwtSecret,
        sign: { algorithm: 'HS256', iss: JWT_ISSUER, aud: JWT_AUDIENCE, expiresIn: '15m' },
        verify: { algorithms: ['HS256'], allowedIss: JWT_ISSUER, allowedAud: JWT_AUDIENCE },
    });
    await app.register(fastifyRateLimit, { global: false, keyGenerator: (request) => request.ip });

    app.decorate('authenticate', async (request) => {
        await request.jwtVerify();
        if (typeof request.user.sub !== 'string' || typeof request.user.sid !== 'string') {
            throw Problems.unauthorized();
        }
        if (!(await persistence.findUserById(request.user.sub))) throw Problems.accountUnavailable();
    });

    app.setErrorHandler((error, request, reply) => {
        if (!(error instanceof HttpProblem)) {
            // Database/validation errors can contain credential values or SQL parameters.
            request.log.error({ status: toHttpProblem(error).definition.status }, 'Request failed');
        }

        const httpProblem = toHttpProblem(error);
        const response = toProblemDetails(httpProblem, request.url.split('?')[0]);

        return reply.code(response.status).type(PROBLEM_DETAILS_MEDIA_TYPE).send(response);
    });

    await registerHealthRoutes(app);
    await registerAuthRoutes(app, persistence);
    await registerAccountDeletionRoutes(app, createAccountDeletionService(persistence));
    const vehicles = createVehicleService(persistence);
    const entries = createEntryService(persistence, vehicles);
    await registerVehicleRoutes(app, vehicles);
    await registerEntryRoutes(app, entries);
    await registerSyncRoutes(app, persistence);

    app.addHook('onClose', async () => persistence.close());

    return app;
}
