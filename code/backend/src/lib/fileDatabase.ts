import fs from "node:fs";
import path from "node:path";
import { DatabaseShape, SyncedRecord } from "../types/domain";
import { createId } from "./ids";

const DATA_DIR = process.env.DRIVECOST_DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const defaultDatabase = (): DatabaseShape => ({
  users: [],
  vehicles: [],
  fuelEntries: [],
  maintenanceEntries: [],
});

export function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDatabase(), null, 2));
  }
}

export function readDatabase(): DatabaseShape {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DatabaseShape;
}

export function writeDatabase(database: DatabaseShape) {
  fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
}

export function upsertByClientId(
  collection: SyncedRecord[],
  prefix: string,
  userId: string,
  payload: object,
): SyncedRecord {
  const payloadRecord = payload as Record<string, unknown>;
  const clientId =
    typeof payloadRecord.clientId === "string" && payloadRecord.clientId.length > 0
      ? payloadRecord.clientId
      : createId(`${prefix}_client`);

  const existingIndex = collection.findIndex(
    (item) => item.userId === userId && item.clientId === clientId,
  );
  const now = new Date().toISOString();
  const {
    id: _id,
    userId: _userId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...attributes
  } = payloadRecord;

  const record: SyncedRecord = {
    ...attributes,
    id: existingIndex >= 0 ? collection[existingIndex].id : createId(prefix),
    clientId,
    userId,
    createdAt: existingIndex >= 0 ? collection[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    collection[existingIndex] = {
      ...collection[existingIndex],
      ...record,
    };
    return collection[existingIndex];
  }

  collection.push(record);
  return record;
}

export function toPublicSyncedRecord(record: SyncedRecord) {
  const { userId: _userId, ...publicRecord } = record;
  return publicRecord;
}
