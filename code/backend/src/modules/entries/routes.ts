import { FastifyInstance } from 'fastify';
import { SyncEntity } from '@drivecost/contracts';
import { DriveCostRepository, toPublicRecord } from '../../platform/persistence/repository';
import {
    FuelEntrySyncInput,
    MaintenanceEntrySyncInput,
    fuelEntrySyncSchema,
    maintenanceEntrySyncSchema,
} from './schemas';
import { problem } from '../../platform/http/problemDetails';

interface DeleteEntryParams {
    clientId: string;
}

const deleteEntryParamsSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['clientId'],
    properties: { clientId: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

export async function registerEntryRoutes(app: FastifyInstance, repository: DriveCostRepository) {
    app.post<{ Body: FuelEntrySyncInput }>(
        '/fuel-entries',
        { onRequest: [app.authenticate], schema: { body: fuelEntrySyncSchema } },
        async (request, reply) => {
            const ownsVehicle = await repository.entityExists(
                request.user.sub,
                SyncEntity.Vehicle,
                request.body.vehicleClientId,
            );

            if (!ownsVehicle) {
                throw problem('vehicleNotFound');
            }

            const record = await repository.upsertEntity(request.user.sub, SyncEntity.FuelEntry, request.body);
            if (!record) {
                return reply.code(204).send();
            }

            reply.code(201);
            return { data: toPublicRecord(record) };
        },
    );

    app.post<{ Body: MaintenanceEntrySyncInput }>(
        '/maintenance-entries',
        { onRequest: [app.authenticate], schema: { body: maintenanceEntrySyncSchema } },
        async (request, reply) => {
            const ownsVehicle = await repository.entityExists(
                request.user.sub,
                SyncEntity.Vehicle,
                request.body.vehicleClientId,
            );

            if (!ownsVehicle) {
                throw problem('vehicleNotFound');
            }

            const record = await repository.upsertEntity(request.user.sub, SyncEntity.MaintenanceEntry, request.body);
            if (!record) {
                return reply.code(204).send();
            }

            reply.code(201);
            return { data: toPublicRecord(record) };
        },
    );

    registerEntryDeleteRoute(app, repository, '/fuel-entries/:clientId', SyncEntity.FuelEntry);
    registerEntryDeleteRoute(app, repository, '/maintenance-entries/:clientId', SyncEntity.MaintenanceEntry);
}

function registerEntryDeleteRoute(
    app: FastifyInstance,
    repository: DriveCostRepository,
    route: string,
    entityType: Exclude<(typeof SyncEntity)[keyof typeof SyncEntity], typeof SyncEntity.Vehicle>,
) {
    app.delete<{ Params: DeleteEntryParams }>(
        route,
        { onRequest: [app.authenticate], schema: { params: deleteEntryParamsSchema } },
        async (request, reply) => {
            await repository.deleteEntity(request.user.sub, entityType, request.params.clientId);
            return reply.code(204).send();
        },
    );
}
