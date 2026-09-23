import crypto from 'node:crypto';
import { ensureDatabase, readDatabase, upsertByClientId, writeDatabase } from '../../lib/fileDatabase';
import { SyncEntity, SyncOperation } from '@drivecost/contracts';
import { AuthSessionRecord, DatabaseShape, SyncChange, SyncedRecord, UserRecord } from '../../types/domain';
import { DriveCostRepository, SyncEntityType } from './repository';

const collectionByEntityType: Record<
    SyncEntityType,
    keyof Pick<DatabaseShape, 'vehicles' | 'fuelEntries' | 'chargingEntries' | 'maintenanceEntries' | 'expenseEntries' | 'recurringExpenses'>
> = {
    [SyncEntity.Vehicle]: 'vehicles',
    [SyncEntity.FuelEntry]: 'fuelEntries',
    [SyncEntity.ChargingEntry]: 'chargingEntries',
    [SyncEntity.MaintenanceEntry]: 'maintenanceEntries',
    [SyncEntity.ExpenseEntry]: 'expenseEntries',
    [SyncEntity.RecurringExpense]: 'recurringExpenses',
};

const idPrefixByEntityType: Record<SyncEntityType, string> = {
    [SyncEntity.Vehicle]: 'vehicle',
    [SyncEntity.FuelEntry]: 'fuel',
    [SyncEntity.ChargingEntry]: 'charging',
    [SyncEntity.MaintenanceEntry]: 'maintenance',
    [SyncEntity.ExpenseEntry]: 'expense',
    [SyncEntity.RecurringExpense]: 'recurring-expense',
};

export class FileRepository implements DriveCostRepository {
    async initialize(): Promise<void> {
        ensureDatabase();
    }

    async findUserByEmail(email: string): Promise<UserRecord | null> {
        return readDatabase().users.find((user) => user.email === email) ?? null;
    }

    async findUserById(userId: string): Promise<UserRecord | null> {
        return readDatabase().users.find((user) => user.id === userId) ?? null;
    }

    async createUserWithSession(user: UserRecord, session: AuthSessionRecord): Promise<void> {
        const database = readDatabase();
        database.users.push(user);
        database.authSessions.push(session);
        writeDatabase(database);
    }

    async createAuthSession(session: AuthSessionRecord): Promise<void> {
        const database = readDatabase();
        database.authSessions.push(session);
        writeDatabase(database);
    }

    async rotateAuthSession(
        sessionId: string,
        currentRefreshTokenHash: string,
        nextRefreshTokenHash: string,
        lastUsedAt: string,
        expiresAt: string,
    ): Promise<{ user: UserRecord; sessionId: string } | null> {
        const database = readDatabase();
        const session = database.authSessions.find((candidate) => candidate.id === sessionId);
        if (
            !session
            || session.revokedAt
            || new Date(session.expiresAt).getTime() <= Date.now()
            || !hashesEqual(session.refreshTokenHash, currentRefreshTokenHash)
        ) {
            return null;
        }
        const user = database.users.find((candidate) => candidate.id === session.userId);
        if (!user) return null;

        session.refreshTokenHash = nextRefreshTokenHash;
        session.lastUsedAt = lastUsedAt;
        session.expiresAt = expiresAt;
        writeDatabase(database);
        return { user, sessionId: session.id };
    }

    async revokeAuthSession(sessionId: string, refreshTokenHash: string): Promise<void> {
        const database = readDatabase();
        const session = database.authSessions.find((candidate) => candidate.id === sessionId);
        if (session && !session.revokedAt && hashesEqual(session.refreshTokenHash, refreshTokenHash)) {
            session.revokedAt = new Date().toISOString();
            writeDatabase(database);
        }
    }

    async upgradeGuestUserWithSession(
        userId: string,
        currentSessionId: string,
        email: string,
        passwordHash: string,
        nextSession: AuthSessionRecord,
    ): Promise<UserRecord | null> {
        const database = readDatabase();
        const user = database.users.find((candidate) => candidate.id === userId);
        if (!user || user.mode !== 'guest') return null;
        if (database.users.some((candidate) => candidate.id !== userId && candidate.email === email)) {
            const error = Object.assign(new Error('Email already registered.'), { code: '23505' });
            throw error;
        }

        user.mode = 'registered';
        user.email = email;
        user.passwordHash = passwordHash;
        const currentSession = database.authSessions.find(
            (candidate) => candidate.id === currentSessionId && candidate.userId === userId,
        );
        if (currentSession && !currentSession.revokedAt) currentSession.revokedAt = new Date().toISOString();
        database.authSessions.push(nextSession);
        writeDatabase(database);
        return user;
    }

    async listEntities(userId: string, entityType: SyncEntityType): Promise<SyncedRecord[]> {
        return this.collection(readDatabase(), entityType).filter((record) => record.userId === userId && !record.deletedAt);
    }

    async entityExists(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean> {
        return (await this.listEntities(userId, entityType)).some((record) => record.clientId === clientId);
    }

    async entityIsDeleted(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean> {
        return this.collection(readDatabase(), entityType).some(
            (record) => record.userId === userId && record.clientId === clientId && Boolean(record.deletedAt),
        );
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

    async deleteVehicle(userId: string, clientId: string): Promise<void> {
        const database = readDatabase();
        const deletedAt = new Date().toISOString();
        this.tombstone(database, userId, SyncEntity.Vehicle, clientId, deletedAt);

        for (const entityType of vehicleOwnedEntityTypes) {
            for (const record of this.collection(database, entityType)) {
                if (record.userId === userId && !record.deletedAt && record.vehicleClientId === clientId) {
                    this.tombstone(database, userId, entityType, record.clientId, deletedAt);
                }
            }
        }
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

    private tombstone(
        database: DatabaseShape,
        userId: string,
        entityType: SyncEntityType,
        clientId: string,
        deletedAt: string,
    ) {
        const collection = this.collection(database, entityType);
        const existing = collection.find((record) => record.userId === userId && record.clientId === clientId);
        if (existing?.deletedAt) return;

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
    }
}

const vehicleOwnedEntityTypes: Array<Exclude<SyncEntityType, typeof SyncEntity.Vehicle>> = [
    SyncEntity.FuelEntry,
    SyncEntity.ChargingEntry,
    SyncEntity.MaintenanceEntry,
    SyncEntity.ExpenseEntry,
    SyncEntity.RecurringExpense,
];

function requiredClientId(payload: object): string {
    const clientId = (payload as { clientId?: unknown }).clientId;
    if (typeof clientId !== 'string' || !clientId) {
        throw new Error('A sync entity requires a clientId.');
    }
    return clientId;
}

function hashesEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
