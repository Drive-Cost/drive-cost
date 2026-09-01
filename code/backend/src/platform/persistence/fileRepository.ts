import { ensureDatabase, readDatabase, upsertByClientId, writeDatabase } from '../../lib/fileDatabase';
import { SyncEntity, SyncOperation } from '@drivecost/contracts';
import { DatabaseShape, SyncChange, SyncedRecord, UserRecord } from '../../types/domain';
import { DriveCostRepository, SyncEntityType } from './repository';

const collectionByEntityType: Record<
    SyncEntityType,
    keyof Pick<DatabaseShape, 'vehicles' | 'fuelEntries' | 'maintenanceEntries'>
> = {
    [SyncEntity.Vehicle]: 'vehicles',
    [SyncEntity.FuelEntry]: 'fuelEntries',
    [SyncEntity.MaintenanceEntry]: 'maintenanceEntries',
};

const idPrefixByEntityType: Record<SyncEntityType, string> = {
    [SyncEntity.Vehicle]: 'vehicle',
    [SyncEntity.FuelEntry]: 'fuel',
    [SyncEntity.MaintenanceEntry]: 'maintenance',
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

    async listEntities(userId: string, entityType: SyncEntityType): Promise<SyncedRecord[]> {
        return this.collection(readDatabase(), entityType).filter((record) => record.userId === userId && !record.deletedAt);
    }

    async entityExists(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean> {
        return (await this.listEntities(userId, entityType)).some((record) => record.clientId === clientId);
    }

    async upsertEntity(userId: string, entityType: SyncEntityType, payload: object): Promise<SyncedRecord | null> {
        const database = readDatabase();
        const collection = this.collection(database, entityType);
        const { clientId: _clientId, ...attributes } = payload as Record<string, unknown>;
        const clientId = requiredClientId(payload);
        const existingRecord = collection.find((record) => record.userId === userId && record.clientId === clientId);
        if (existingRecord?.deletedAt) {
            return null;
        }
        const record = upsertByClientId(
            collection,
            idPrefixByEntityType[entityType],
            userId,
            payload,
        );
        database.syncChanges.push({
            sequence: database.syncChanges.length + 1,
            userId,
            entityType,
            operation: SyncOperation.Upsert,
            entityId: record.id,
            clientId: record.clientId,
            payload: { clientId: record.clientId, ...attributes },
            createdAt: record.updatedAt,
        });
        writeDatabase(database);
        return record;
    }

    async deleteEntity(
        userId: string,
        entityType: Exclude<SyncEntityType, 'vehicle'>,
        clientId: string,
    ): Promise<void> {
        const database = readDatabase();
        const collection = this.collection(database, entityType);
        const existingRecord = collection.find((record) => record.userId === userId && record.clientId === clientId);
        if (existingRecord?.deletedAt) {
            return;
        }

        const deletedAt = new Date().toISOString();
        const record = upsertByClientId(collection, idPrefixByEntityType[entityType], userId, { clientId, deletedAt });
        database.syncChanges.push({
            sequence: database.syncChanges.length + 1,
            userId,
            entityType,
            operation: SyncOperation.Delete,
            entityId: record.id,
            clientId,
            payload: { clientId },
            createdAt: deletedAt,
        });
        writeDatabase(database);
    }

    async listChanges(userId: string, after: number, limit: number): Promise<SyncChange[]> {
        return readDatabase()
            .syncChanges.filter((change) => change.userId === userId && change.sequence > after)
            .map((change) => ({ ...change, operation: change.operation ?? SyncOperation.Upsert }))
            .slice(0, limit);
    }

    async close(): Promise<void> {}

    private collection(database: DatabaseShape, entityType: SyncEntityType) {
        return database[collectionByEntityType[entityType]];
    }
}

function requiredClientId(payload: object): string {
    const clientId = (payload as { clientId?: unknown }).clientId;
    if (typeof clientId !== 'string' || !clientId) {
        throw new Error('A sync entity requires a clientId.');
    }
    return clientId;
}
