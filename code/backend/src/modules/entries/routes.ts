import { AdoptionProtocol } from '@drivecost/contracts';
import { requestsAdoption } from '../../platform/http/adoption';
import { FastifyInstance } from 'fastify';
import { SyncEntity } from '@drivecost/contracts';
import { toPublicRecord } from '../../platform/persistence/repository';
import {
  chargingEntrySyncSchema,
  fuelEntrySyncSchema,
  maintenanceEntrySyncSchema,
  expenseEntrySyncSchema,
  recurringExpenseSyncSchema,
} from './schemas';
import type { EntryService, EntryEntityType } from './service';
import type { SyncPayloadByEntity } from '@drivecost/contracts';
import { HttpStatus } from '../../platform/http/statusCodes';

interface DeleteEntryParams {
  clientId: string;
}

const deleteEntryParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['clientId'],
  properties: { clientId: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

export async function registerEntryRoutes(app: FastifyInstance, service: EntryService) {
  registerEntryUpsertRoute(app, service, '/fuel-entries', SyncEntity.FuelEntry, fuelEntrySyncSchema);
  registerEntryUpsertRoute(app, service, '/charging-entries', SyncEntity.ChargingEntry, chargingEntrySyncSchema);
  registerEntryUpsertRoute(app, service, '/ownership-expenses', SyncEntity.ExpenseEntry, expenseEntrySyncSchema);
  registerEntryUpsertRoute(
    app,
    service,
    '/recurring-expenses',
    SyncEntity.RecurringExpense,
    recurringExpenseSyncSchema
  );
  registerEntryUpsertRoute(
    app,
    service,
    '/maintenance-entries',
    SyncEntity.MaintenanceEntry,
    maintenanceEntrySyncSchema
  );

  registerEntryDeleteRoute(app, service, '/fuel-entries/:clientId', SyncEntity.FuelEntry);
  registerEntryDeleteRoute(app, service, '/charging-entries/:clientId', SyncEntity.ChargingEntry);
  registerEntryDeleteRoute(app, service, '/maintenance-entries/:clientId', SyncEntity.MaintenanceEntry);
  registerEntryDeleteRoute(app, service, '/ownership-expenses/:clientId', SyncEntity.ExpenseEntry);
  registerEntryDeleteRoute(app, service, '/recurring-expenses/:clientId', SyncEntity.RecurringExpense);
}

function registerEntryUpsertRoute(
  app: FastifyInstance,
  service: EntryService,
  route: string,
  entityType: EntryEntityType,
  schema: object
) {
  for (const adoptionOnly of [false, true])
    app.post<{ Body: SyncPayloadByEntity[EntryEntityType] }>(
      adoptionOnly ? `${route}${AdoptionProtocol.pathSuffix}` : route,
      { onRequest: [app.authenticate], schema: { body: schema } },
      async (request, reply) => {
        const record = await service.upsert(
          request.user.sub,
          entityType,
          request.body,
          adoptionOnly || requestsAdoption(request.headers)
        );
        if (!record) return reply.code(HttpStatus.NO_CONTENT).send();

        reply.code(HttpStatus.CREATED);
        return { data: toPublicRecord(record) };
      }
    );
}

function registerEntryDeleteRoute(
  app: FastifyInstance,
  service: EntryService,
  route: string,
  entityType: EntryEntityType
) {
  app.delete<{ Params: DeleteEntryParams }>(
    route,
    { onRequest: [app.authenticate], schema: { params: deleteEntryParamsSchema } },
    async (request, reply) => {
      await service.delete(request.user.sub, entityType, request.params.clientId);
      return reply.code(HttpStatus.NO_CONTENT).send();
    }
  );
}
