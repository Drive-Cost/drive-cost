import { SyncEntity, SyncEntityType } from './sync';

const CLIENT_ID_PREFIX_BY_ENTITY: Record<SyncEntityType, string> = {
    [SyncEntity.Vehicle]: 'vehicle',
    [SyncEntity.FuelEntry]: 'fuel',
    [SyncEntity.ChargingEntry]: 'charging',
    [SyncEntity.MaintenanceEntry]: 'maintenance',
};

/**
 * Generates an opaque identifier owned by this device. It is persisted with the
 * local entity and is the idempotency key used by the backend during sync.
 */
export function createClientId(entityType: SyncEntityType): string {
    const random = Math.random().toString(36).slice(2, 12);
    return `${CLIENT_ID_PREFIX_BY_ENTITY[entityType]}_${Date.now().toString(36)}_${random}`;
}
