import { SyncChange, SyncedRecord, UserRecord } from "../../types/domain";

export type SyncEntityType =
  | "vehicle"
  | "fuel_entry"
  | "maintenance_entry";

export interface DriveCostRepository {
  initialize(): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  listEntities(userId: string, entityType: SyncEntityType): Promise<SyncedRecord[]>;
  entityExists(
    userId: string,
    entityType: SyncEntityType,
    clientId: string,
  ): Promise<boolean>;
  upsertEntity(
    userId: string,
    entityType: SyncEntityType,
    payload: object,
  ): Promise<SyncedRecord>;
  listChanges(userId: string, after: number, limit: number): Promise<SyncChange[]>;
  close(): Promise<void>;
}

export function toPublicRecord(record: SyncedRecord) {
  const { userId: _userId, ...publicRecord } = record;
  return publicRecord;
}
