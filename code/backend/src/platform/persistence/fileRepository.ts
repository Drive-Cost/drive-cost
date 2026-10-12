import { isDeepStrictEqual } from 'node:util';
import { Problems } from '../http/problemDetails';
import crypto from 'node:crypto';
import { ensureDatabase, readDatabase, syncDatabaseDirectory, upsertByClientId, writeDatabase } from '../../lib/fileDatabase';
import { SyncEntity, SyncOperation } from '@drivecost/contracts';
import { AuthSessionRecord, DatabaseShape, DeletionReceipt, SyncChange, SyncedRecord, UserRecord } from '../../types/domain';
import { DriveCostRepository, SyncEntityType } from './repository';
import { createDeletionReceipt } from './deletionReceipt';

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
        requireUser(database, session.userId);
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

    async upsertEntity(userId: string, entityType: SyncEntityType, payload: object, createOnly = false): Promise<SyncedRecord | null> {
        const database = readDatabase();
        requireUser(database, userId);
        const collection = this.collection(database, entityType);
        const { clientId: _clientId, ...attributes } = payload as Record<string, unknown>;
        const clientId = requiredClientId(payload);
        const existingRecord = collection.find((record) => record.userId === userId && record.clientId === clientId);
        if (createOnly && existingRecord) {
            const { id: _id, userId: _owner, clientId: _identity, createdAt: _createdAt, updatedAt: _updatedAt, deletedAt, ...existingAttributes } = existingRecord;
            if (deletedAt || !isDeepStrictEqual(JSON.parse(JSON.stringify(attributes)), existingAttributes)) {
                throw Problems.adoptionConflict();
            }
            return existingRecord;
        }
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
            sequence: database.nextChangeSequence++,
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
        requireUser(database, userId);
        const collection = this.collection(database, entityType);
        const existingRecord = collection.find((record) => record.userId === userId && record.clientId === clientId);
        if (existingRecord?.deletedAt) {
            return;
        }

        const deletedAt = new Date().toISOString();
        const record = upsertByClientId(collection, idPrefixByEntityType[entityType], userId, { clientId, deletedAt });
        database.syncChanges.push({
            sequence: database.nextChangeSequence++,
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
        requireUser(database, userId);
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

    async findDeletionReceipt(secretHash: string): Promise<DeletionReceipt | null> {
        const database = readDatabase();
        const retained = database.deletionReceipts.filter((receipt) => Date.parse(receipt.expiresAt) > Date.now());
        if (retained.length !== database.deletionReceipts.length) {
            database.deletionReceipts = retained;
            writeDatabase(database);
        }
        const receipt = retained.find((candidate) => candidate.secretHash === secretHash) ?? null;
        // Recovery must also complete durability after a post-rename sync failure.
        if (receipt) syncDatabaseDirectory();
        return receipt;
    }

    async deleteAccount(
        userId: string, sessionId: string, secretHash: string,
        confirm: (user: UserRecord, session: AuthSessionRecord) => Promise<void>,
    ): Promise<DeletionReceipt> {
        const snapshot = readDatabase();
        const user = requireUser(snapshot, userId);
        const session = requireLiveSession(snapshot, userId, sessionId);
        await confirm(user, session);
        // Password verification yields: re-read before the synchronous atomic commit.
        const database = readDatabase();
        const currentUser = requireUser(database, userId);
        const currentSession = requireLiveSession(database, userId, sessionId);
        if (!isDeepStrictEqual(currentUser, user) || !isDeepStrictEqual(currentSession, session)) {
            throw Problems.deletionConfirmationFailed();
        }
        database.deletionReceipts = database.deletionReceipts.filter((receipt) => Date.parse(receipt.expiresAt) > Date.now());
        if (database.deletionReceipts.some((receipt) => receipt.secretHash === secretHash)) {
            throw Problems.deletionOperationConflict();
        }
        const receipt = createDeletionReceipt(secretHash, userId);
        database.deletionReceipts.push(receipt);
        database.users = database.users.filter((record) => record.id !== userId);
        database.authSessions = database.authSessions.filter((record) => record.userId !== userId);
        database.syncChanges = database.syncChanges.filter((record) => record.userId !== userId);
        for (const collection of Object.values(collectionByEntityType)) {
            database[collection] = database[collection].filter((record) => record.userId !== userId);
        }
        writeDatabase(database);
        return receipt;
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
            sequence: database.nextChangeSequence++,
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

function requireUser(database: DatabaseShape, userId: string): UserRecord {
    const user = database.users.find((candidate) => candidate.id === userId);
    if (!user) throw Problems.accountUnavailable();
    return user;
}
function requireLiveSession(database: DatabaseShape, userId: string, sessionId: string): AuthSessionRecord {
    const session = database.authSessions.find((candidate) => candidate.id === sessionId && candidate.userId === userId);
    if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) throw Problems.unauthorized();
    return session;
}
