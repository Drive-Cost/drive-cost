import postgres, { Sql } from "postgres";
import { createId } from "../../lib/ids";
import { SyncChange, SyncedRecord, UserRecord } from "../../types/domain";
import { DriveCostRepository, SyncEntityType } from "./repository";

interface EntityRow {
  id: string;
  userId: string;
  clientId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  mode: UserRecord["mode"];
  email: string | null;
  passwordHash: string | null;
  createdAt: Date;
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

  async createUser(user: UserRecord): Promise<void> {
    await this.sql`
      INSERT INTO users (id, mode, email, password_hash, created_at)
      VALUES (${user.id}, ${user.mode}, ${user.email ?? null}, ${user.passwordHash ?? null}, ${user.createdAt})
    `;
  }

  async listEntities(userId: string, entityType: SyncEntityType): Promise<SyncedRecord[]> {
    const rows = await this.sql<EntityRow[]>`
      SELECT id, user_id, client_id, payload, created_at, updated_at
      FROM sync_entities
      WHERE user_id = ${userId} AND entity_type = ${entityType}
      ORDER BY sequence ASC
    `;
    return rows.map(toSyncedRecord);
  }

  async entityExists(userId: string, entityType: SyncEntityType, clientId: string): Promise<boolean> {
    const [row] = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM sync_entities
        WHERE user_id = ${userId} AND entity_type = ${entityType} AND client_id = ${clientId}
      ) AS exists
    `;
    return row?.exists ?? false;
  }

  async upsertEntity(
    userId: string,
    entityType: SyncEntityType,
    payload: object,
  ): Promise<SyncedRecord> {
    const { clientId, attributes } = splitPayload(payload);
    const [row] = await this.sql<EntityRow[]>`
      INSERT INTO sync_entities (id, user_id, entity_type, client_id, payload)
      VALUES (
        ${createId(entityType)},
        ${userId},
        ${entityType},
        ${clientId},
        ${this.sql.json(attributes as Parameters<Sql["json"]>[0])}
      )
      ON CONFLICT (user_id, entity_type, client_id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      RETURNING id, user_id, client_id, payload, created_at, updated_at
    `;

    if (!row) throw new Error("Postgres upsert did not return a record.");
    await this.sql`
      INSERT INTO sync_changes (user_id, entity_type, entity_id, client_id, payload)
      VALUES (${userId}, ${entityType}, ${row.id}, ${clientId}, ${this.sql.json({ clientId, ...attributes } as Parameters<Sql["json"]>[0])})
    `;
    return toSyncedRecord(row);
  }

  async listChanges(userId: string, after: number, limit: number): Promise<SyncChange[]> {
    const rows = await this.sql<SyncChange[]>`
      SELECT sequence, user_id, entity_type, entity_id, client_id, payload, created_at
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

function toSafeCursor(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^\d+$/.test(value))
  ) {
    throw new Error("Postgres returned an unsupported sync cursor.");
  }

  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw new Error("Postgres returned an unsupported sync cursor.");
  }
  return cursor;
}

function splitPayload(payload: object) {
  const { clientId, id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...attributes } = payload as Record<string, unknown>;
  if (typeof clientId !== "string" || !clientId) {
    throw new Error("A sync entity requires a clientId.");
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
  };
}
