import { AuthSessionRecord, SyncChange, SyncedRecord, UserRecord } from '../../types/domain';
import { SyncEntityType } from '@drivecost/contracts';

export type { SyncEntityType } from '@drivecost/contracts';

export interface DriveCostRepository {
    initialize(): Promise<void>;
    findUserByEmail(email: string): Promise<UserRecord | null>;
    findUserById(userId: string): Promise<UserRecord | null>;
    createUserWithSession(user: UserRecord, session: AuthSessionRecord): Promise<void>;
    createAuthSession(session: AuthSessionRecord): Promise<void>;
    rotateAuthSession(
        sessionId: string,
        currentRefreshTokenHash: string,
        nextRefreshTokenHash: string,
        lastUsedAt: string,
        expiresAt: string,
    ): Promise<{ user: UserRecord; sessionId: string } | null>;
    revokeAuthSession(sessionId: string, refreshTokenHash: string): Promise<void>;
    upgradeGuestUserWithSession(
        userId: string,
        currentSessionId: string,
        email: string,
        passwordHash: string,
        nextSession: AuthSessionRecord,
    ): Promise<UserRecord | null>;
    listEntities(userId: string, entityType: SyncEntityType): Promise<SyncedRecord[]>;
    entityExists(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean>;
    entityIsDeleted(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean>;
    upsertEntity(userId: string, entityType: SyncEntityType, payload: object): Promise<SyncedRecord | null>;
    deleteEntity(userId: string, entityType: Exclude<SyncEntityType, 'vehicle'>, clientId: string): Promise<void>;
    deleteVehicle(userId: string, clientId: string): Promise<void>;
    listChanges(userId: string, after: number, limit: number): Promise<SyncChange[]>;
    close(): Promise<void>;
}

export function toPublicRecord(record: SyncedRecord) {
    const { userId: _userId, ...publicRecord } = record;
    return publicRecord;
}
