import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseShape } from "../types/domain";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const defaultDatabase = (): DatabaseShape => ({
  users: [],
  sessions: [],
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

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function upsertByClientId<T extends { id: string; clientId: string }>(
  collection: T[],
  prefix: string,
  payload: Record<string, unknown>,
) {
  const clientId =
    typeof payload.clientId === "string" && payload.clientId.length > 0
      ? payload.clientId
      : createId(`${prefix}_client`);

  const payloadId = typeof payload.id === "string" ? payload.id : undefined;
  const existingIndex = collection.findIndex(
    (item) => item.clientId === clientId || item.id === payloadId,
  );

  const record = {
    ...payload,
    id: existingIndex >= 0 ? collection[existingIndex].id : createId(prefix),
    clientId,
    updatedAt: new Date().toISOString(),
  } as T;

  if (existingIndex >= 0) {
    collection[existingIndex] = {
      ...collection[existingIndex],
      ...record,
    };
    return collection[existingIndex];
  }

  const createdRecord = {
    createdAt: new Date().toISOString(),
    ...record,
  } as T;

  collection.push(createdRecord);
  return createdRecord;
}
