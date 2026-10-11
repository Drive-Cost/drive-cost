import { SyncEntity } from '@drivecost/contracts';
import type { SyncEntityType, SyncPayloadByEntity } from '@drivecost/contracts';
import type { DriveCostRepository } from '../../platform/persistence/repository';
import { Problems } from '../../platform/http/problemDetails';
import type { VehicleService } from '../vehicles/service';

export type EntryEntityType = Exclude<SyncEntityType, typeof SyncEntity.Vehicle>;
type EntryRepository = Pick<DriveCostRepository, 'upsertEntity' | 'deleteEntity'>;

export function createEntryService(repository: EntryRepository, vehicles: Pick<VehicleService, 'availability'>) {
    return {
        upsert: async <Entity extends EntryEntityType>(
            userId: string,
            entityType: Entity,
            input: SyncPayloadByEntity[Entity],
        ) => {
            const availability = await vehicles.availability(userId, input.vehicleClientId);
            if (availability === 'deleted') return null;
            if (availability === 'missing') throw Problems.vehicleNotFound();
            return repository.upsertEntity(userId, entityType, input);
        },
        delete: (userId: string, entityType: EntryEntityType, clientId: string) =>
            repository.deleteEntity(userId, entityType, clientId),
    };
}

export type EntryService = ReturnType<typeof createEntryService>;
