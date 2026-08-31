import { PullResponse, RemoteChange } from "../../../domain/sync";

export interface PullSyncDependencies<Transaction> {
  getCursor: () => Promise<number>;
  pullChanges: (after: number) => Promise<unknown>;
  withTransaction: (operation: (transaction: Transaction) => Promise<void>) => Promise<void>;
  applyChange: (change: RemoteChange, transaction: Transaction) => Promise<void>;
  setCursor: (cursor: number, transaction: Transaction) => Promise<void>;
}

export async function reconcilePulledChanges<Transaction>(
  dependencies: PullSyncDependencies<Transaction>,
): Promise<number> {
  let cursor = await dependencies.getCursor();
  let appliedChanges = 0;

  for (;;) {
    const response = parsePullResponse(await dependencies.pullChanges(cursor), cursor);

    if (response.data.length === 0) {
      return appliedChanges;
    }

    await dependencies.withTransaction(async (transaction) => {
      for (const change of response.data) {
        await dependencies.applyChange(change, transaction);
      }
      await dependencies.setCursor(response.nextCursor, transaction);
    });

    cursor = response.nextCursor;
    appliedChanges += response.data.length;
  }
}

function parsePullResponse(value: unknown, after: number): PullResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || !isCursor(value.nextCursor)) {
    throw new Error("The backend returned an invalid sync response.");
  }

  const changes = value.data.map(parseRemoteChange);
  const lastSequence = changes.at(-1)?.sequence;

  if (
    (changes.length === 0 && value.nextCursor !== after) ||
    (lastSequence !== undefined &&
      (lastSequence <= after || value.nextCursor !== lastSequence))
  ) {
    throw new Error("The backend returned an invalid sync cursor.");
  }

  for (let index = 1; index < changes.length; index += 1) {
    if (changes[index].sequence <= changes[index - 1].sequence) {
      throw new Error("The backend returned unordered sync changes.");
    }
  }

  return { data: changes, nextCursor: value.nextCursor };
}

function parseRemoteChange(value: unknown): RemoteChange {
  if (!isRecord(value) || !isCursor(value.sequence) || !isRecord(value.payload)) {
    throw new Error("The backend returned an invalid sync change.");
  }

  switch (value.entityType) {
    case "vehicle":
      return { sequence: value.sequence, entityType: value.entityType, payload: parseVehicle(value.payload) };
    case "fuel_entry":
      return { sequence: value.sequence, entityType: value.entityType, payload: parseFuelEntry(value.payload) };
    case "maintenance_entry":
      return {
        sequence: value.sequence,
        entityType: value.entityType,
        payload: parseMaintenanceEntry(value.payload),
      };
    default:
      throw new Error("The backend returned an unsupported sync entity.");
  }
}

function parseVehicle(payload: Record<string, unknown>) {
  return {
    clientId: requiredString(payload, "clientId"),
    brand: requiredString(payload, "brand"),
    model: requiredString(payload, "model"),
    year: requiredInteger(payload, "year"),
    label: optionalString(payload, "label"),
    fuelType: optionalString(payload, "fuelType"),
    engine: optionalString(payload, "engine"),
    powerHp: optionalInteger(payload, "powerHp"),
    transmission: optionalString(payload, "transmission"),
    ownershipStartMileage: requiredInteger(payload, "ownershipStartMileage"),
    trackingStartMileage: requiredInteger(payload, "trackingStartMileage"),
    currentOdometer: requiredInteger(payload, "currentOdometer"),
  };
}

function parseFuelEntry(payload: Record<string, unknown>) {
  return {
    ...parseEntryBase(payload),
    liters: requiredNumber(payload, "liters"),
    price: requiredNumber(payload, "price"),
  };
}

function parseMaintenanceEntry(payload: Record<string, unknown>) {
  return {
    ...parseEntryBase(payload),
    type: requiredString(payload, "type"),
    description: requiredString(payload, "description"),
    cost: requiredNumber(payload, "cost"),
  };
}

function parseEntryBase(payload: Record<string, unknown>) {
  return {
    clientId: requiredString(payload, "clientId"),
    vehicleClientId: requiredString(payload, "vehicleClientId"),
    date: requiredString(payload, "date"),
    odometer: requiredInteger(payload, "odometer"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCursor(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function requiredString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The backend returned an invalid ${field}.`);
  }
  return value;
}

function optionalString(payload: Record<string, unknown>, field: string): string | undefined {
  const value = payload[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`The backend returned an invalid ${field}.`);
  }
  return value;
}

function requiredInteger(payload: Record<string, unknown>, field: string): number {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`The backend returned an invalid ${field}.`);
  }
  return value;
}

function optionalInteger(payload: Record<string, unknown>, field: string): number | undefined {
  const value = payload[field];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`The backend returned an invalid ${field}.`);
  }
  return value;
}

function requiredNumber(payload: Record<string, unknown>, field: string): number {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`The backend returned an invalid ${field}.`);
  }
  return value;
}
