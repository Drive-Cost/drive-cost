import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseShape, SyncedRecord } from '../types/domain';
import { createId } from './ids';

const DATA_DIR = process.env.DRIVECOST_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const defaultDatabase = (): DatabaseShape => ({
  deletionReceipts: [],
  nextChangeSequence: 1,
  users: [],
  authSessions: [],
  syncChanges: [],
  vehicles: [],
  fuelEntries: [],
  chargingEntries: [],
  maintenanceEntries: [],
  expenseEntries: [],
  recurringExpenses: [],
});

export function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    writeDatabase(defaultDatabase());
  }
}

export function readDatabase(): DatabaseShape {
  ensureDatabase();
  const database = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<DatabaseShape>;
  const syncChanges = database.syncChanges ?? [];
  const nextChangeSequence = syncChanges.reduce(
    (next, change) => Math.max(next, change.sequence + 1),
    database.nextChangeSequence ?? 1
  );
  return { ...defaultDatabase(), ...database, syncChanges, nextChangeSequence };
}

export function writeDatabase(database: DatabaseShape) {
  // Single-process development adapter: synchronous replacement is its commit boundary.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporaryFile = path.join(DATA_DIR, `.db-${randomUUID()}.tmp`);
  try {
    const descriptor = fs.openSync(temporaryFile, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, JSON.stringify(database, null, 2));
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryFile, DB_FILE);
    syncDatabaseDirectory();
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

export function syncDatabaseDirectory(): void {
  const directory = fs.openSync(DATA_DIR, 'r');
  try {
    fs.fsyncSync(directory);
  } finally {
    fs.closeSync(directory);
  }
}

export function upsertByClientId(
  collection: SyncedRecord[],
  prefix: string,
  userId: string,
  payload: object
): SyncedRecord {
  const payloadRecord = payload as Record<string, unknown>;
  const clientId =
    typeof payloadRecord.clientId === 'string' && payloadRecord.clientId.length > 0
      ? payloadRecord.clientId
      : createId(`${prefix}_client`);

  const existingIndex = collection.findIndex(item => item.userId === userId && item.clientId === clientId);
  const now = new Date().toISOString();
  const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...attributes } = payloadRecord;

  const record: SyncedRecord = {
    ...attributes,
    id: existingIndex >= 0 ? collection[existingIndex].id : createId(prefix),
    clientId,
    userId,
    createdAt: existingIndex >= 0 ? collection[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    collection[existingIndex] = { ...collection[existingIndex], ...record };
    return collection[existingIndex];
  }

  collection.push(record);
  return record;
}

export function toPublicSyncedRecord(record: SyncedRecord) {
  const { userId: _userId, ...publicRecord } = record;
  return publicRecord;
}
