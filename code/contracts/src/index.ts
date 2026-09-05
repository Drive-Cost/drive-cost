export const SyncEntity = {
    Vehicle: 'vehicle',
    FuelEntry: 'fuel_entry',
    ChargingEntry: 'charging_entry',
    MaintenanceEntry: 'maintenance_entry',
} as const;

export type SyncEntityType = (typeof SyncEntity)[keyof typeof SyncEntity];

export const SyncOperation = { Upsert: 'upsert', Delete: 'delete' } as const;

export type SyncOperation = (typeof SyncOperation)[keyof typeof SyncOperation];

export const SyncRoute = {
    GuestSession: '/auth/guest',
    Vehicles: '/vehicles',
    FuelEntries: '/fuel-entries',
    ChargingEntries: '/charging-entries',
    MaintenanceEntries: '/maintenance-entries',
    Changes: '/sync',
} as const;

export const SyncRouteByEntity = {
    [SyncEntity.Vehicle]: SyncRoute.Vehicles,
    [SyncEntity.FuelEntry]: SyncRoute.FuelEntries,
    [SyncEntity.ChargingEntry]: SyncRoute.ChargingEntries,
    [SyncEntity.MaintenanceEntry]: SyncRoute.MaintenanceEntries,
} as const;

export interface VehicleSyncPayload {
    clientId: string;
    brand: string;
    model: string;
    year: number;
    label?: string;
    fuelType?: string;
    engine?: string;
    powerHp?: number;
    transmission?: string;
    ownershipStartMileage: number;
    trackingStartMileage: number;
    currentOdometer: number;
}

interface EntrySyncPayload {
    clientId: string;
    vehicleClientId: string;
    date: string;
    odometer: number;
}

export interface FuelEntrySyncPayload extends EntrySyncPayload {
    liters: number;
    price: number;
}

export interface ChargingEntrySyncPayload extends EntrySyncPayload {
    kWh: number;
    price: number;
}

export interface MaintenanceEntrySyncPayload extends EntrySyncPayload {
    type: string;
    description: string;
    cost: number;
}

export interface SyncPayloadByEntity {
    [SyncEntity.Vehicle]: VehicleSyncPayload;
    [SyncEntity.FuelEntry]: FuelEntrySyncPayload;
    [SyncEntity.ChargingEntry]: ChargingEntrySyncPayload;
    [SyncEntity.MaintenanceEntry]: MaintenanceEntrySyncPayload;
}

export type SyncPayload = SyncPayloadByEntity[SyncEntityType];

export interface DeleteSyncPayload {
    clientId: string;
}

export interface SyncOperationByEntity {
    [SyncEntity.Vehicle]: typeof SyncOperation.Upsert;
    [SyncEntity.FuelEntry]: SyncOperation;
    [SyncEntity.ChargingEntry]: SyncOperation;
    [SyncEntity.MaintenanceEntry]: SyncOperation;
}

export type SyncPayloadByOperation<
    EntityType extends SyncEntityType,
    Operation extends SyncOperationByEntity[EntityType],
> = Operation extends typeof SyncOperation.Upsert ? SyncPayloadByEntity[EntityType] : DeleteSyncPayload;

export type RemoteChange = {
    [EntityType in SyncEntityType]: {
        [Operation in SyncOperationByEntity[EntityType]]: {
            sequence: number;
            entityType: EntityType;
            operation: Operation;
            payload: SyncPayloadByOperation<EntityType, Operation>;
        };
    }[SyncOperationByEntity[EntityType]];
}[SyncEntityType];

export interface PullResponse {
    data: RemoteChange[];
    nextCursor: number;
}

export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
}

const syncEntities = new Set<SyncEntityType>(Object.values(SyncEntity));

export function decodeSyncEntity(value: unknown): SyncEntityType {
    if (typeof value !== 'string' || !syncEntities.has(value as SyncEntityType)) {
        throw new Error('Unsupported sync entity.');
    }
    return value as SyncEntityType;
}

export function decodeSyncPayload<
    EntityType extends SyncEntityType,
    Operation extends SyncOperationByEntity[EntityType],
>(
    entityType: EntityType,
    operation: Operation,
    value: unknown,
): SyncPayloadByOperation<EntityType, Operation> {
    if (operation === SyncOperation.Delete) {
        return decodeDeletePayload(value) as SyncPayloadByOperation<EntityType, Operation>;
    }
    return syncPayloadDecoderByEntity[entityType](value) as SyncPayloadByOperation<EntityType, Operation>;
}

export function decodeSyncOperation<EntityType extends SyncEntityType>(
    entityType: EntityType,
    value: unknown,
): SyncOperationByEntity[EntityType] {
    if (value === SyncOperation.Upsert) {
        return value as SyncOperationByEntity[EntityType];
    }
    if (value === SyncOperation.Delete && entityType !== SyncEntity.Vehicle) {
        return value as SyncOperationByEntity[EntityType];
    }
    throw new Error('Unsupported sync operation.');
}

export function decodePullResponse(value: unknown, after: number): PullResponse {
    if (!isRecord(value) || !Array.isArray(value.data) || !isCursor(value.nextCursor)) {
        throw new Error('Invalid sync response.');
    }

    const changes = value.data.map(decodeRemoteChange);
    const lastSequence = changes.at(-1)?.sequence;
    if (
        (changes.length === 0 && value.nextCursor !== after) ||
        (lastSequence !== undefined && (lastSequence <= after || value.nextCursor !== lastSequence))
    ) {
        throw new Error('Invalid sync cursor.');
    }

    for (let index = 1; index < changes.length; index += 1) {
        if (changes[index].sequence <= changes[index - 1].sequence) {
            throw new Error('Sync changes must be ordered by sequence.');
        }
    }
    return { data: changes, nextCursor: value.nextCursor };
}

export function decodeProblemDetails(value: unknown): ProblemDetails | null {
    if (
        !isRecord(value) ||
        typeof value.type !== 'string' ||
        typeof value.title !== 'string' ||
        !isHttpStatus(value.status)
    ) {
        return null;
    }

    const detail = optionalString(value, 'detail');
    const instance = optionalString(value, 'instance');
    return {
        type: value.type,
        title: value.title,
        status: value.status,
        ...(detail === undefined ? {} : { detail }),
        ...(instance === undefined ? {} : { instance }),
    };
}

const syncPayloadDecoderByEntity: {
    [EntityType in SyncEntityType]: (value: unknown) => SyncPayloadByEntity[EntityType];
} = {
    [SyncEntity.Vehicle]: decodeVehicle,
    [SyncEntity.FuelEntry]: decodeFuelEntry,
    [SyncEntity.ChargingEntry]: decodeChargingEntry,
    [SyncEntity.MaintenanceEntry]: decodeMaintenanceEntry,
};

function decodeRemoteChange(value: unknown): RemoteChange {
    if (!isRecord(value) || !isCursor(value.sequence)) throw new Error('Invalid sync change.');
    const entityType = decodeSyncEntity(value.entityType);
    const operation = decodeSyncOperation(entityType, value.operation);
    return {
        sequence: value.sequence,
        entityType,
        operation,
        payload: decodeSyncPayload(entityType, operation, value.payload),
    } as RemoteChange;
}

function decodeDeletePayload(value: unknown): DeleteSyncPayload {
    const payload = requiredRecord(value);
    return { clientId: requiredString(payload, 'clientId') };
}

function decodeVehicle(value: unknown): VehicleSyncPayload {
    const payload = requiredRecord(value);
    return {
        clientId: requiredString(payload, 'clientId'),
        brand: requiredString(payload, 'brand'),
        model: requiredString(payload, 'model'),
        year: requiredInteger(payload, 'year'),
        label: optionalString(payload, 'label'),
        fuelType: optionalString(payload, 'fuelType'),
        engine: optionalString(payload, 'engine'),
        powerHp: optionalInteger(payload, 'powerHp'),
        transmission: optionalString(payload, 'transmission'),
        ownershipStartMileage: requiredInteger(payload, 'ownershipStartMileage'),
        trackingStartMileage: requiredInteger(payload, 'trackingStartMileage'),
        currentOdometer: requiredInteger(payload, 'currentOdometer'),
    };
}

function decodeFuelEntry(value: unknown): FuelEntrySyncPayload {
    const payload = requiredRecord(value);
    return {
        ...decodeEntryBase(payload),
        liters: requiredNumber(payload, 'liters'),
        price: requiredNumber(payload, 'price'),
    };
}

function decodeChargingEntry(value: unknown): ChargingEntrySyncPayload {
    const payload = requiredRecord(value);
    return {
        ...decodeEntryBase(payload),
        kWh: requiredNumber(payload, 'kWh'),
        price: requiredNumber(payload, 'price'),
    };
}

function decodeMaintenanceEntry(value: unknown): MaintenanceEntrySyncPayload {
    const payload = requiredRecord(value);
    return {
        ...decodeEntryBase(payload),
        type: requiredString(payload, 'type'),
        description: requiredString(payload, 'description'),
        cost: requiredNumber(payload, 'cost'),
    };
}

function decodeEntryBase(payload: Record<string, unknown>): EntrySyncPayload {
    return {
        clientId: requiredString(payload, 'clientId'),
        vehicleClientId: requiredString(payload, 'vehicleClientId'),
        date: requiredString(payload, 'date'),
        odometer: requiredInteger(payload, 'odometer'),
    };
}

function requiredRecord(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) throw new Error('Invalid sync payload.');
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCursor(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isHttpStatus(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 100 && value <= 599;
}

function requiredString(payload: Record<string, unknown>, field: string): string {
    const value = payload[field];
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${field}.`);
    return value;
}

function optionalString(payload: Record<string, unknown>, field: string): string | undefined {
    const value = payload[field];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new Error(`Invalid ${field}.`);
    return value;
}

function requiredInteger(payload: Record<string, unknown>, field: string): number {
    const value = payload[field];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Invalid ${field}.`);
    }
    return value;
}

function optionalInteger(payload: Record<string, unknown>, field: string): number | undefined {
    const value = payload[field];
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Invalid ${field}.`);
    }
    return value;
}

function requiredNumber(payload: Record<string, unknown>, field: string): number {
    const value = payload[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid ${field}.`);
    }
    return value;
}
