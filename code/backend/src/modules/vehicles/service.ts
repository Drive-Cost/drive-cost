import { SyncEntity } from '@drivecost/contracts';
import type { VehicleSyncPayload } from '@drivecost/contracts';
import type { DriveCostRepository } from '../../platform/persistence/repository';
import { Problems } from '../../platform/http/problemDetails';

type VehicleRepository = Pick<
  DriveCostRepository,
  'listEntities' | 'upsertEntity' | 'deleteVehicle' | 'entityExists' | 'entityIsDeleted'
>;

export function createVehicleService(repository: VehicleRepository) {
  return {
    list: (userId: string) => repository.listEntities(userId, SyncEntity.Vehicle),
    upsert: (userId: string, input: VehicleSyncPayload, createOnly = false) => {
      if (
        input.trackingStartMileage < input.ownershipStartMileage ||
        input.currentOdometer < input.trackingStartMileage
      ) {
        throw Problems.invalidMileageBaseline();
      }
      return createOnly
        ? repository.upsertEntity(userId, SyncEntity.Vehicle, input, true)
        : repository.upsertEntity(userId, SyncEntity.Vehicle, input);
    },
    delete: (userId: string, clientId: string) => repository.deleteVehicle(userId, clientId),
    availability: async (userId: string, clientId: string): Promise<'active' | 'deleted' | 'missing'> => {
      if (await repository.entityExists(userId, SyncEntity.Vehicle, clientId)) return 'active';
      return (await repository.entityIsDeleted(userId, SyncEntity.Vehicle, clientId)) ? 'deleted' : 'missing';
    },
  };
}

export type VehicleService = ReturnType<typeof createVehicleService>;
