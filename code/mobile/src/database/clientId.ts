import type { RecordIdentity, StoredIdentity } from '../models/record';

export function requirePersistedClientId(clientId: string | null | undefined, entityName: string): string {
  if (typeof clientId !== 'string' || clientId.length === 0) {
    throw new Error(`${entityName} is missing its sync client ID.`);
  }
  return clientId;
}

export function requirePersistedLocalId(id: number | null | undefined, entityName: string): number {
  if (typeof id !== 'number' || !Number.isSafeInteger(id)) {
    throw new Error(`${entityName} is missing its local ID.`);
  }
  return id;
}

export function decodePersistedRecord<Row extends StoredIdentity>(
  row: Row,
  entityName: string
): Omit<Row, keyof RecordIdentity> & RecordIdentity {
  return {
    ...row,
    id: requirePersistedLocalId(row.id, entityName),
    clientId: requirePersistedClientId(row.clientId, entityName),
  };
}
