import { FastifyInstance } from 'fastify';
import { SyncEntity } from '@drivecost/contracts';
import { DriveCostRepository, toPublicRecord } from '../../platform/persistence/repository';
import { VehicleSyncInput, vehicleSyncSchema } from './schemas';
import { problem } from '../../platform/http/problemDetails';

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
                throw problem('invalidMileageBaseline');
            }

            const record = await repository.upsertEntity(request.user.sub, SyncEntity.Vehicle, request.body);

            reply.code(201);
            return { data: toPublicRecord(record) };
        },
    );
}
