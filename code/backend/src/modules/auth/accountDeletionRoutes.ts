import type { FastifyInstance } from 'fastify';
import {
    AccountRoute,
    accountDeletionRequestSchema,
    accountDeletionStatusSchema,
    completedAccountDeletionSchema,
    deletionStatusRequestSchema,
} from '@drivecost/contracts';
import type { AccountDeletionRequest, DeletionStatusRequest } from '@drivecost/contracts';
import type { createAccountDeletionService } from './accountDeletion';
import { Problems } from '../../platform/http/problemDetails';
import { HttpStatus } from '../../platform/http/statusCodes';

export async function registerAccountDeletionRoutes(
    app: FastifyInstance,
    service: ReturnType<typeof createAccountDeletionService>
) {
    const confirmationLimit = app.createRateLimit({
        max: 5,
        timeWindow: '1 minute',
        keyGenerator: request => `account-deletion:${request.user.sub}`,
    });
    app.post<{ Body: AccountDeletionRequest }>(
        AccountRoute.Deletion,
        {
            preValidation: async request => {
                if (
                    typeof request.body === 'object' &&
                    request.body !== null &&
                    Object.keys(request.body).some(
                        key => !['operationSecret', 'password', 'refreshToken'].includes(key)
                    )
                ) {
                    throw Problems.invalidRequest();
                }
            },
            preHandler: [
                app.authenticate,
                async (request, reply) => {
                    const limit = await confirmationLimit(request);
                    if (!limit.isAllowed && limit.isExceeded) {
                        reply.header('Retry-After', limit.ttlInSeconds);
                        throw Problems.rateLimited();
                    }
                },
            ],
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            schema: {
                body: accountDeletionRequestSchema,
                response: { [HttpStatus.OK]: completedAccountDeletionSchema },
            },
        },
        async (request, reply) => {
            reply.header('Cache-Control', 'no-store');
            return service.deleteAccount(request.user, request.body);
        }
    );
    app.post<{ Body: DeletionStatusRequest }>(
        AccountRoute.DeletionStatus,
        {
            config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
            schema: { body: deletionStatusRequestSchema, response: { [HttpStatus.OK]: accountDeletionStatusSchema } },
        },
        async (request, reply) => {
            reply.header('Cache-Control', 'no-store');
            return service.status(request.body.operationSecret);
        }
    );
}
