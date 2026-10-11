import { FastifyInstance } from 'fastify';
import { toPublicRecord } from '../../platform/persistence/repository';
import { VehicleSyncInput, vehicleSyncSchema } from './schemas';
import type { VehicleService } from './service';
import { HttpStatus } from '../../platform/http/statusCodes';

interface DeleteVehicleParams {
    clientId: string;
}

const deleteVehicleParamsSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['clientId'],
    properties: { clientId: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

export async function registerVehicleRoutes(app: FastifyInstance, service: VehicleService) {
    app.get('/vehicles', { onRequest: [app.authenticate] }, async (request) => {
        return { data: (await service.list(request.user.sub)).map(toPublicRecord) };
    });

    app.post<{ Body: VehicleSyncInput }>(
        '/vehicles',
        { onRequest: [app.authenticate], schema: { body: vehicleSyncSchema } },
        async (request, reply) => {
            const record = await service.upsert(request.user.sub, request.body);
            if (!record) {
                return reply.code(HttpStatus.NO_CONTENT).send();
            }

            reply.code(HttpStatus.CREATED);
            return { data: toPublicRecord(record) };
        },
    );

    app.delete<{ Params: DeleteVehicleParams }>(
        '/vehicles/:clientId',
        { onRequest: [app.authenticate], schema: { params: deleteVehicleParamsSchema } },
        async (request, reply) => {
            await service.delete(request.user.sub, request.params.clientId);
            return reply.code(HttpStatus.NO_CONTENT).send();
        },
    );
}
