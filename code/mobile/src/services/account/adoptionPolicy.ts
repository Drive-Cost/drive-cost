import { decodeSyncEntity, decodeSyncOperation, decodeSyncPayload, SyncOperation } from '../../domain/sync';
import type { RemoteChange } from '../../domain/sync';
import { entityKey } from '../../database/accountDataRepository';
import type { AccountDataset, AccountEntity } from '../../database/accountDataRepository';
import { AccountDataError } from './accountErrors';

export function decodeAccountEntity(entityType: string, encoded: string): AccountEntity {
  const value: unknown = JSON.parse(encoded);
  switch (decodeSyncEntity(entityType)) {
    case 'vehicle':
      return { entityType: 'vehicle', payload: decodeSyncPayload('vehicle', SyncOperation.Upsert, value) };
    case 'fuel_entry':
      return { entityType: 'fuel_entry', payload: decodeSyncPayload('fuel_entry', SyncOperation.Upsert, value) };
    case 'charging_entry':
      return {
        entityType: 'charging_entry',
        payload: decodeSyncPayload('charging_entry', SyncOperation.Upsert, value),
      };
    case 'maintenance_entry':
      return {
        entityType: 'maintenance_entry',
        payload: decodeSyncPayload('maintenance_entry', SyncOperation.Upsert, value),
      };
    case 'expense_entry':
      return { entityType: 'expense_entry', payload: decodeSyncPayload('expense_entry', SyncOperation.Upsert, value) };
    case 'recurring_expense':
      return {
        entityType: 'recurring_expense',
        payload: decodeSyncPayload('recurring_expense', SyncOperation.Upsert, value),
      };
  }
}

/** Unbound datasets have no proof that a matching cloud identity belongs to them. */
export function assertSafeAdoption(dataset: AccountDataset, changes: RemoteChange[]): void {
  const remoteIdentities = new Set(changes.map(entityKey));
  const local = new Map(dataset.entities.map(entity => [entityKey(entity), entity]));
  if (dataset.entities.some(entity => remoteIdentities.has(entityKey(entity)))) {
    throw new AccountDataError(
      'Some device records overlap with your account data. They cannot be combined safely. Your device data is unchanged.'
    );
  }
  try {
    for (const entity of dataset.entities) decodeAccountEntity(entity.entityType, JSON.stringify(entity.payload));
    for (const job of dataset.pending) {
      const entityType = decodeSyncEntity(job.entityType);
      const operation = decodeSyncOperation(entityType, job.operation);
      if (operation !== SyncOperation.Upsert) throw new Error('Unbound deletion cannot be attributed safely.');
      const entity = decodeAccountEntity(entityType, job.payload);
      const current = local.get(entityKey(entity));
      if (!current) throw new Error('Pending record no longer exists.');
      if (
        'vehicleClientId' in entity.payload &&
        (!('vehicleClientId' in current.payload) || entity.payload.vehicleClientId !== current.payload.vehicleClientId)
      ) {
        throw new Error('Pending record has a different parent.');
      }
    }
  } catch {
    throw new AccountDataError(
      'Some pending device changes cannot be added safely. Your device data is unchanged. You can cancel or use your account data instead.'
    );
  }
}
