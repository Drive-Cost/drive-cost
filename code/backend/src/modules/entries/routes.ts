import { FastifyInstance } from 'fastify';
import { SyncEntity } from '@drivecost/contracts';
import { DriveCostRepository, toPublicRecord } from '../../platform/persistence/repository';
import {
    chargingEntrySyncSchema,
    fuelEntrySyncSchema,
    maintenanceEntrySyncSchema,
    expenseEntrySyncSchema,
    recurringExpenseSyncSchema,
} from './schemas';
import { Problems } from '../../platform/http/problemDetails';
import { HttpStatus } from '../../platform/http/statusCodes';

interface DeleteEntryParams {
    clientId: string;
}

interface VehicleOwnedEntry {
    vehicleClientId: string;
}

const deleteEntryParamsSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['clientId'],
    properties: { clientId: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

export async function registerEntryRoutes(app: FastifyInstance, repository: DriveCostRepository) {
    registerEntryUpsertRoute(app, repository, '/fuel-entries', SyncEntity.FuelEntry, fuelEntrySyncSchema);
    registerEntryUpsertRoute(app, repository, '/charging-entries', SyncEntity.ChargingEntry, chargingEntrySyncSchema);
    registerEntryUpsertRoute(app, repository, '/ownership-expenses', SyncEntity.ExpenseEntry, expenseEntrySyncSchema);
    registerEntryUpsertRoute(
        app,
        repository,
        '/recurring-expenses',
        SyncEntity.RecurringExpense,
        recurringExpenseSyncSchema,
    );
    registerEntryUpsertRoute(
        app,
        repository,
        '/maintenance-entries',
        SyncEntity.MaintenanceEntry,
        maintenanceEntrySyncSchema,
    );

    registerEntryDeleteRoute(app, repository, '/fuel-entries/:clientId', SyncEntity.FuelEntry);
    registerEntryDeleteRoute(app, repository, '/charging-entries/:clientId', SyncEntity.ChargingEntry);
    registerEntryDeleteRoute(app, repository, '/maintenance-entries/:clientId', SyncEntity.MaintenanceEntry);
    registerEntryDeleteRoute(app, repository, '/ownership-expenses/:clientId', SyncEntity.ExpenseEntry);
    registerEntryDeleteRoute(app, repository, '/recurring-expenses/:clientId', SyncEntity.RecurringExpense);
}

function registerEntryUpsertRoute(
    app: FastifyInstance,
    repository: DriveCostRepository,
    route: string,
    entityType: Exclude<(typeof SyncEntity)[keyof typeof SyncEntity], typeof SyncEntity.Vehicle>,
    schema: object,
) {
    app.post<{ Body: VehicleOwnedEntry }>(
        route,
        { onRequest: [app.authenticate], schema: { body: schema } },
        async (request, reply) => {
            const ownsVehicle = await repository.entityExists(
                request.user.sub,
                SyncEntity.Vehicle,
                request.body.vehicleClientId,
            );
            if (!ownsVehicle) {
                if (
                    await repository.entityIsDeleted(request.user.sub, SyncEntity.Vehicle, request.body.vehicleClientId)
                ) {
                    return reply.code(HttpStatus.NO_CONTENT).send();
                }
                throw Problems.vehicleNotFound();
            }

            const record = await repository.upsertEntity(request.user.sub, entityType, request.body);
            if (!record) return reply.code(HttpStatus.NO_CONTENT).send();

            reply.code(HttpStatus.CREATED);
            return { data: toPublicRecord(record) };
        },
    );
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
            return reply.code(HttpStatus.NO_CONTENT).send();
        },
    );
}
