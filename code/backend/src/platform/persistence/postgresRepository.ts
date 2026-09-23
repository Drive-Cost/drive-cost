import postgres, { Sql, TransactionSql } from 'postgres';
import { createId } from '../../lib/ids';
import { AuthSessionRecord, SyncChange, SyncedRecord, UserRecord } from '../../types/domain';
import { DriveCostRepository, SyncEntityType } from './repository';
import { SyncEntity, SyncOperation } from '@drivecost/contracts';

interface EntityRow {
    id: string;
    userId: string;
    entityType?: SyncEntityType;
    clientId: string;
    payload: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

interface UserRow {
    id: string;
    mode: UserRecord['mode'];
    email: string | null;
    passwordHash: string | null;
    createdAt: Date;
}

interface SessionUserRow extends UserRow {
    sessionId: string;
}

export class PostgresRepository implements DriveCostRepository {
    private readonly sql: Sql;

    constructor(databaseUrl: string) {
        this.sql = postgres(databaseUrl, { transform: postgres.camel });
    }

    async initialize(): Promise<void> {
        await this.sql`SELECT 1`;
    }

    async findUserByEmail(email: string): Promise<UserRecord | null> {
        const [row] = await this.sql<UserRow[]>`
      SELECT id, mode, email, password_hash, created_at
      FROM users
      WHERE email = ${email}
    `;
        return row ? toUserRecord(row) : null;
    }

    async findUserById(userId: string): Promise<UserRecord | null> {
        const [row] = await this.sql<UserRow[]>`
          SELECT id, mode, email, password_hash, created_at
          FROM users
          WHERE id = ${userId}
        `;
        return row ? toUserRecord(row) : null;
    }

    async createUserWithSession(user: UserRecord, session: AuthSessionRecord): Promise<void> {
        await this.sql.begin(async (transaction) => {
            await transaction`
              INSERT INTO users (id, mode, email, password_hash, created_at)
              VALUES (${user.id}, ${user.mode}, ${user.email ?? null}, ${user.passwordHash ?? null}, ${user.createdAt})
            `;
            await insertAuthSession(transaction, session);
        });
    }

    async createAuthSession(session: AuthSessionRecord): Promise<void> {
        await insertAuthSession(this.sql, session);
    }

    async rotateAuthSession(
        sessionId: string,
        currentRefreshTokenHash: string,
        nextRefreshTokenHash: string,
        lastUsedAt: string,
        expiresAt: string,
    ): Promise<{ user: UserRecord; sessionId: string } | null> {
        const [row] = await this.sql<SessionUserRow[]>`
          WITH rotated AS (
            UPDATE auth_sessions
            SET refresh_token_hash = ${nextRefreshTokenHash},
                last_used_at = ${lastUsedAt},
                expires_at = ${expiresAt}
            WHERE id = ${sessionId}
              AND refresh_token_hash = ${currentRefreshTokenHash}
              AND revoked_at IS NULL
              AND expires_at > now()
            RETURNING id, user_id
          )
          SELECT users.id, users.mode, users.email, users.password_hash, users.created_at,
                 rotated.id AS session_id
          FROM rotated
          JOIN users ON users.id = rotated.user_id
        `;
        return row ? { user: toUserRecord(row), sessionId: row.sessionId } : null;
    }

    async revokeAuthSession(sessionId: string, refreshTokenHash: string): Promise<void> {
        await this.sql`
          UPDATE auth_sessions
          SET revoked_at = now()
          WHERE id = ${sessionId}
            AND refresh_token_hash = ${refreshTokenHash}
            AND revoked_at IS NULL
        `;
    }

    async upgradeGuestUserWithSession(
        userId: string,
        currentSessionId: string,
        email: string,
        passwordHash: string,
        nextSession: AuthSessionRecord,
    ): Promise<UserRecord | null> {
        return this.sql.begin(async (transaction) => {
            const [row] = await transaction<UserRow[]>`
              UPDATE users
              SET mode = 'registered', email = ${email}, password_hash = ${passwordHash}
              WHERE id = ${userId} AND mode = 'guest'
              RETURNING id, mode, email, password_hash, created_at
            `;
            if (!row) return null;

            await transaction`
              UPDATE auth_sessions
              SET revoked_at = now()
              WHERE id = ${currentSessionId} AND user_id = ${userId} AND revoked_at IS NULL
            `;
            await insertAuthSession(transaction, nextSession);
            return toUserRecord(row);
        });
    }

    async listEntities(userId: string, entityType: SyncEntityType): Promise<SyncedRecord[]> {
        const rows = await this.sql<EntityRow[]>`
      SELECT id, user_id, client_id, payload, created_at, updated_at, deleted_at
      FROM sync_entities
      WHERE user_id = ${userId} AND entity_type = ${entityType} AND deleted_at IS NULL
      ORDER BY sequence ASC
    `;
        return rows.map(toSyncedRecord);
    }

    async entityExists(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean> {
        const [row] = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM sync_entities
        WHERE user_id = ${userId} AND entity_type = ${entityType} AND client_id = ${clientId} AND deleted_at IS NULL
      ) AS exists
    `;
        return row?.exists ?? false;
    }

    async entityIsDeleted(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean> {
        const [row] = await this.sql<{ exists: boolean }[]>`
          SELECT EXISTS(
            SELECT 1 FROM sync_entities
            WHERE user_id = ${userId} AND entity_type = ${entityType} AND client_id = ${clientId} AND deleted_at IS NOT NULL
          ) AS exists
        `;
        return row?.exists ?? false;
    }

    async upsertEntity(userId: string, entityType: SyncEntityType, payload: object): Promise<SyncedRecord | null> {
        const { clientId, attributes } = splitPayload(payload);
        return this.sql.begin(async (transaction) => {
            if (entityType !== 'vehicle') {
                const vehicleClientId = (attributes as { vehicleClientId?: unknown }).vehicleClientId;
                if (typeof vehicleClientId !== 'string') throw new Error('A vehicle-owned sync entity requires a vehicle client ID.');
                const [vehicle] = await transaction<{ id: string }[]>`
                  SELECT id FROM sync_entities
                  WHERE user_id = ${userId}
                    AND entity_type = ${SyncEntity.Vehicle}
                    AND client_id = ${vehicleClientId}
                    AND deleted_at IS NULL
                  FOR UPDATE
                `;
                if (!vehicle) return null;
            }
            const [row] = await transaction<EntityRow[]>`
      INSERT INTO sync_entities (id, user_id, entity_type, client_id, payload)
      VALUES (
        ${createId(entityType)},
        ${userId},
        ${entityType},
        ${clientId},
        ${transaction.json(attributes as Parameters<Sql['json']>[0])}
      )
      ON CONFLICT (user_id, entity_type, client_id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      WHERE sync_entities.deleted_at IS NULL
      RETURNING id, user_id, client_id, payload, created_at, updated_at, deleted_at
    `;

            if (!row) return null;
            await transaction`
      INSERT INTO sync_changes (user_id, entity_type, operation, entity_id, client_id, payload)
      VALUES (${userId}, ${entityType}, ${SyncOperation.Upsert}, ${row.id}, ${clientId}, ${transaction.json({ clientId, ...attributes } as Parameters<Sql['json']>[0])})
    `;
            return toSyncedRecord(row);
        });
    }

    async deleteEntity(
        userId: string,
        entityType: Exclude<SyncEntityType, 'vehicle'>,
        clientId: string,
    ): Promise<void> {
        await this.sql.begin(async (transaction) => {
            const [row] = await transaction<EntityRow[]>`
        INSERT INTO sync_entities (id, user_id, entity_type, client_id, payload, deleted_at)
        VALUES (
          ${createId(entityType)},
          ${userId},
          ${entityType},
          ${clientId},
          ${transaction.json({} as Parameters<Sql['json']>[0])},
          now()
        )
        ON CONFLICT (user_id, entity_type, client_id)
        DO UPDATE SET deleted_at = now(), updated_at = now()
        WHERE sync_entities.deleted_at IS NULL
        RETURNING id, user_id, client_id, payload, created_at, updated_at, deleted_at
      `;

            if (!row) return;
            await transaction`
        INSERT INTO sync_changes (user_id, entity_type, operation, entity_id, client_id, payload)
        VALUES (${userId}, ${entityType}, ${SyncOperation.Delete}, ${row.id}, ${clientId}, ${transaction.json({ clientId } as Parameters<Sql['json']>[0])})
      `;
        });
    }

    async deleteVehicle(userId: string, clientId: string): Promise<void> {
        await this.sql.begin(async (transaction) => {
            const vehicle = await tombstoneEntity(transaction, userId, SyncEntity.Vehicle, clientId);
            if (!vehicle) return;

            const childRows = await transaction<EntityRow[]>`
              UPDATE sync_entities
              SET deleted_at = now(), updated_at = now()
              WHERE user_id = ${userId}
                AND entity_type IN (${SyncEntity.FuelEntry}, ${SyncEntity.ChargingEntry}, ${SyncEntity.MaintenanceEntry}, ${SyncEntity.ExpenseEntry}, ${SyncEntity.RecurringExpense})
                AND deleted_at IS NULL
                AND payload->>'vehicleClientId' = ${clientId}
              RETURNING id, user_id, entity_type, client_id, payload, created_at, updated_at, deleted_at
            `;
            await appendDeleteChange(transaction, userId, SyncEntity.Vehicle, vehicle, clientId);
            for (const child of childRows) {
                if (!child.entityType || child.entityType === SyncEntity.Vehicle) {
                    throw new Error('Deleted vehicle child is missing its sync entity type.');
                }
                await appendDeleteChange(transaction, userId, child.entityType, child, child.clientId);
            }
        });
    }

    async listChanges(userId: string, after: number, limit: number): Promise<SyncChange[]> {
        const rows = await this.sql<SyncChange[]>`
      SELECT sequence, user_id, entity_type, operation, entity_id, client_id, payload, created_at
      FROM sync_changes
      WHERE user_id = ${userId} AND sequence > ${after}
      ORDER BY sequence ASC
      LIMIT ${limit}
    `;
        return rows.map((row) => ({
            ...row,
            sequence: toSafeCursor(row.sequence),
            createdAt: new Date(row.createdAt).toISOString(),
        }));
    }

    async close(): Promise<void> {
        await this.sql.end();
    }
}

async function tombstoneEntity(
    transaction: Sql | TransactionSql,
    userId: string,
    entityType: SyncEntityType,
    clientId: string,
): Promise<EntityRow | null> {
    const [row] = await transaction<EntityRow[]>`
      INSERT INTO sync_entities (id, user_id, entity_type, client_id, payload, deleted_at)
      VALUES (${createId(entityType)}, ${userId}, ${entityType}, ${clientId}, ${transaction.json({} as Parameters<Sql['json']>[0])}, now())
      ON CONFLICT (user_id, entity_type, client_id)
      DO UPDATE SET deleted_at = now(), updated_at = now()
      WHERE sync_entities.deleted_at IS NULL
      RETURNING id, user_id, client_id, payload, created_at, updated_at, deleted_at
    `;
    return row ?? null;
}

async function appendDeleteChange(
    transaction: Sql | TransactionSql,
    userId: string,
    entityType: SyncEntityType,
    row: EntityRow,
    clientId: string,
): Promise<void> {
    await transaction`
      INSERT INTO sync_changes (user_id, entity_type, operation, entity_id, client_id, payload)
      VALUES (${userId}, ${entityType}, ${SyncOperation.Delete}, ${row.id}, ${clientId}, ${transaction.json({ clientId } as Parameters<Sql['json']>[0])})
    `;
}

async function insertAuthSession(
    sql: Sql | TransactionSql,
    session: AuthSessionRecord,
): Promise<void> {
    await sql`
      INSERT INTO auth_sessions (
        id, user_id, refresh_token_hash, created_at, last_used_at, expires_at, revoked_at
      ) VALUES (
        ${session.id}, ${session.userId}, ${session.refreshTokenHash}, ${session.createdAt},
        ${session.lastUsedAt}, ${session.expiresAt}, ${session.revokedAt ?? null}
      )
    `;
}


function toSafeCursor(value: unknown): number {
    if (
        (typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !/^\d+$/.test(value))
    ) {
        throw new Error('Postgres returned an unsupported sync cursor.');
    }

    const cursor = Number(value);
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
        throw new Error('Postgres returned an unsupported sync cursor.');
    }
    return cursor;
}

function splitPayload(payload: object) {
    const {
        clientId,
        id: _id,
        userId: _userId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...attributes
    } = payload as Record<string, unknown>;
    if (typeof clientId !== 'string' || !clientId) {
        throw new Error('A sync entity requires a clientId.');
    }

    return { clientId, attributes };
}

function toUserRecord(row: UserRow): UserRecord {
    return {
        id: row.id,
        mode: row.mode,
        ...(row.email ? { email: row.email } : {}),
        ...(row.passwordHash ? { passwordHash: row.passwordHash } : {}),
        createdAt: row.createdAt.toISOString(),
    };
}

function toSyncedRecord(row: EntityRow): SyncedRecord {
    return {
        ...row.payload,
        id: row.id,
        userId: row.userId,
        clientId: row.clientId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ...(row.deletedAt ? { deletedAt: row.deletedAt.toISOString() } : {}),
    };
}
