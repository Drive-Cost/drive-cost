import { FastifyInstance } from 'fastify';
import { SyncEntity } from '@drivecost/contracts';
import { DriveCostRepository, toPublicRecord } from '../../platform/persistence/repository';
import { VehicleSyncInput, vehicleSyncSchema } from './schemas';
import { Problems } from '../../platform/http/problemDetails';
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

export async function registerVehicleRoutes(app: FastifyInstance, repository: DriveCostRepository) {
    app.get('/vehicles', { onRequest: [app.authenticate] }, async (request) => {
        return { data: (await repository.listEntities(request.user.sub, SyncEntity.Vehicle)).map(toPublicRecord) };
    });

    app.post<{ Body: VehicleSyncInput }>(
        '/vehicles',
        { onRequest: [app.authenticate], schema: { body: vehicleSyncSchema } },
        async (request, reply) => {
            if (
                request.body.trackingStartMileage < request.body.ownershipStartMileage ||
                request.body.currentOdometer < request.body.trackingStartMileage
            ) {
                throw Problems.invalidMileageBaseline();
            }

            const record = await repository.upsertEntity(request.user.sub, SyncEntity.Vehicle, request.body);
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
            await repository.deleteVehicle(request.user.sub, request.params.clientId);
            return reply.code(HttpStatus.NO_CONTENT).send();
        },
    );
}
