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

            reply.code(201);
            return { data: toPublicRecord(record) };
        },
    );
}
