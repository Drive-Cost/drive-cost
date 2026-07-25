import {
  ensureDatabase,
  readDatabase,
  upsertByClientId,
  writeDatabase,
} from "../../lib/fileDatabase";
import { DatabaseShape, SyncChange, SyncedRecord, UserRecord } from "../../types/domain";
import { DriveCostRepository, SyncEntityType } from "./repository";

const collectionByEntityType: Record<SyncEntityType, keyof Pick<
  DatabaseShape,
  "vehicles" | "fuelEntries" | "maintenanceEntries"
>> = {
  vehicle: "vehicles",
  fuel_entry: "fuelEntries",
  maintenance_entry: "maintenanceEntries",
};

const idPrefixByEntityType: Record<SyncEntityType, string> = {
  vehicle: "vehicle",
  fuel_entry: "fuel",
  maintenance_entry: "maintenance",
};

export class FileRepository implements DriveCostRepository {
  async initialize(): Promise<void> {
    ensureDatabase();
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return readDatabase().users.find((user) => user.email === email) ?? null;
  }

  async createUser(user: UserRecord): Promise<void> {
    const database = readDatabase();
    database.users.push(user);
    writeDatabase(database);
  }

  async listEntities(
    userId: string,
    entityType: SyncEntityType,
  ): Promise<SyncedRecord[]> {
    return this.collection(readDatabase(), entityType).filter(
      (record) => record.userId === userId,
    );
  }

  async entityExists(
    userId: string,
    entityType: SyncEntityType,
    clientId: string,
  ): Promise<boolean> {
    return (await this.listEntities(userId, entityType)).some(
      (record) => record.clientId === clientId,
    );
  }

  async upsertEntity(
    userId: string,
    entityType: SyncEntityType,
    payload: object,
  ): Promise<SyncedRecord> {
    const database = readDatabase();
    const record = upsertByClientId(
      this.collection(database, entityType),
      idPrefixByEntityType[entityType],
      userId,
      payload,
    );
    database.syncChanges.push({
      sequence: database.syncChanges.length + 1,
      userId,
      entityType,
      entityId: record.id,
      clientId: record.clientId,
      payload: payload as Record<string, unknown>,
      createdAt: record.updatedAt,
    });
    writeDatabase(database);
    return record;
  }

  async listChanges(userId: string, after: number, limit: number): Promise<SyncChange[]> {
    return readDatabase().syncChanges
      .filter((change) => change.userId === userId && change.sequence > after)
      .slice(0, limit);
  }

  async close(): Promise<void> {}

  private collection(database: DatabaseShape, entityType: SyncEntityType) {
    return database[collectionByEntityType[entityType]];
  }
}
