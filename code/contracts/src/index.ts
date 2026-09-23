export const SyncEntity = {
    Vehicle: 'vehicle',
    FuelEntry: 'fuel_entry',
    ChargingEntry: 'charging_entry',
    MaintenanceEntry: 'maintenance_entry',
    ExpenseEntry: 'expense_entry',
    RecurringExpense: 'recurring_expense',
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
    ExpenseEntries: '/ownership-expenses',
    RecurringExpenses: '/recurring-expenses',
    Changes: '/sync',
} as const;

export const AuthRoute = {
    Guest: '/auth/guest',
    Register: '/auth/register',
    Login: '/auth/login',
    Refresh: '/auth/refresh',
    Upgrade: '/auth/upgrade',
    Logout: '/auth/logout',
} as const;

export const UserMode = {
    Guest: 'guest',
    Registered: 'registered',
} as const;

export type UserMode = (typeof UserMode)[keyof typeof UserMode];

export interface SafeUser {
    id: string;
    mode: UserMode;
    email?: string;
}

export interface CredentialsRequest {
    email: string;
    password: string;
}

export interface RefreshRequest {
    refreshToken: string;
}

export interface LogoutRequest {
    refreshToken: string;
}

export interface SessionResponse {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    user: SafeUser;
}

const authEmailSchema = { type: 'string', format: 'email', maxLength: 254 } as const;
const authPasswordSchema = { type: 'string', minLength: 12, maxLength: 128 } as const;
const refreshTokenSchema = { type: 'string', minLength: 1, maxLength: 512 } as const;

export const credentialsRequestSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],
    properties: { email: authEmailSchema, password: authPasswordSchema },
} as const;

export const refreshRequestSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['refreshToken'],
    properties: { refreshToken: refreshTokenSchema },
} as const;

export const logoutRequestSchema = refreshRequestSchema;

export const safeUserSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'mode'],
    properties: {
        id: { type: 'string' },
        mode: { type: 'string', enum: Object.values(UserMode) },
        email: authEmailSchema,
    },
} as const;

export const sessionResponseSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['accessToken', 'refreshToken', 'accessTokenExpiresAt', 'user'],
    properties: {
        accessToken: { type: 'string' },
        refreshToken: refreshTokenSchema,
        accessTokenExpiresAt: { type: 'string', format: 'date-time' },
        user: safeUserSchema,
    },
} as const;

export const SyncRouteByEntity = {
    [SyncEntity.Vehicle]: SyncRoute.Vehicles,
    [SyncEntity.FuelEntry]: SyncRoute.FuelEntries,
    [SyncEntity.ChargingEntry]: SyncRoute.ChargingEntries,
    [SyncEntity.MaintenanceEntry]: SyncRoute.MaintenanceEntries,
    [SyncEntity.ExpenseEntry]: SyncRoute.ExpenseEntries,
    [SyncEntity.RecurringExpense]: SyncRoute.RecurringExpenses,
} as const;

export const FuelFillStatus = {
    Full: 'full',
    Partial: 'partial',
    Unknown: 'unknown',
} as const;

export type FuelFillStatus = (typeof FuelFillStatus)[keyof typeof FuelFillStatus];

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
    trackingStartDate?: string | null;
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
    fillStatus: FuelFillStatus;
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

export const ExpenseCategory = {
    Insurance: 'insurance', Tax: 'tax', Inspection: 'inspection', Tolls: 'tolls', Parking: 'parking', CarWash: 'carWash', FinancingInterest: 'financingInterest', Accessories: 'accessories', Other: 'other',
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export interface ExpenseEntrySyncPayload {
    clientId: string;
    vehicleClientId: string;
    date: string;
    category: ExpenseCategory;
    totalPaid: number;
    description?: string;
    odometer?: number;
}

export interface RecurringExpenseSyncPayload {
    clientId: string;
    vehicleClientId: string;
    category: ExpenseCategory;
    amount: number;
    periodMonths: 1 | 3 | 6 | 12;
    startDate: string;
    nextDueDate?: string;
    description?: string;
    active: boolean;
}

export interface SyncPayloadByEntity {
    [SyncEntity.Vehicle]: VehicleSyncPayload;
    [SyncEntity.FuelEntry]: FuelEntrySyncPayload;
    [SyncEntity.ChargingEntry]: ChargingEntrySyncPayload;
    [SyncEntity.MaintenanceEntry]: MaintenanceEntrySyncPayload;
    [SyncEntity.ExpenseEntry]: ExpenseEntrySyncPayload;
    [SyncEntity.RecurringExpense]: RecurringExpenseSyncPayload;
}

export type SyncPayload = SyncPayloadByEntity[SyncEntityType];

export interface DeleteSyncPayload {
    clientId: string;
}

export interface SyncOperationByEntity {
    [SyncEntity.Vehicle]: SyncOperation;
    [SyncEntity.FuelEntry]: SyncOperation;
    [SyncEntity.ChargingEntry]: SyncOperation;
    [SyncEntity.MaintenanceEntry]: SyncOperation;
    [SyncEntity.ExpenseEntry]: SyncOperation;
    [SyncEntity.RecurringExpense]: SyncOperation;
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
    if (value === SyncOperation.Delete) {
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
    [SyncEntity.ExpenseEntry]: decodeExpenseEntry,
    [SyncEntity.RecurringExpense]: decodeRecurringExpense,
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
        trackingStartDate: optionalCalendarDate(payload, 'trackingStartDate'),
        currentOdometer: requiredInteger(payload, 'currentOdometer'),
    };
}

function decodeFuelEntry(value: unknown): FuelEntrySyncPayload {
    const payload = requiredRecord(value);
    return {
        ...decodeEntryBase(payload),
        liters: requiredNumber(payload, 'liters'),
        price: requiredNumber(payload, 'price'),
        fillStatus: decodeFuelFillStatus(payload.fillStatus),
    };
}

function decodeFuelFillStatus(value: unknown): FuelFillStatus {
    if (value === undefined) return FuelFillStatus.Unknown;
    if (value === FuelFillStatus.Full || value === FuelFillStatus.Partial || value === FuelFillStatus.Unknown) {
        return value;
    }
    throw new Error('Invalid fillStatus.');
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

function decodeExpenseEntry(value: unknown): ExpenseEntrySyncPayload {
    const payload = requiredRecord(value);
    return {
        clientId: requiredString(payload, 'clientId'),
        vehicleClientId: requiredString(payload, 'vehicleClientId'),
        date: requiredCalendarDateTime(payload, 'date'),
        category: decodeExpenseCategory(payload.category),
        totalPaid: requiredPositiveNumber(payload, 'totalPaid'),
        description: optionalString(payload, 'description'),
        odometer: optionalInteger(payload, 'odometer'),
    };
}

function decodeRecurringExpense(value: unknown): RecurringExpenseSyncPayload {
    const payload = requiredRecord(value);
    const periodMonths = requiredInteger(payload, 'periodMonths');
    if (periodMonths !== 1 && periodMonths !== 3 && periodMonths !== 6 && periodMonths !== 12) throw new Error('Invalid periodMonths.');
    const active = payload.active;
    if (typeof active !== 'boolean') throw new Error('Invalid active.');
    return {
        clientId: requiredString(payload, 'clientId'), vehicleClientId: requiredString(payload, 'vehicleClientId'),
        category: decodeExpenseCategory(payload.category), amount: requiredPositiveNumber(payload, 'amount'), periodMonths,
        startDate: requiredRecurringDateTime(payload, 'startDate'), nextDueDate: optionalRecurringDateTime(payload, 'nextDueDate'),
        description: optionalString(payload, 'description'), active,
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

function decodeExpenseCategory(value: unknown): ExpenseCategory {
    if (!Object.values(ExpenseCategory).includes(value as ExpenseCategory)) throw new Error('Invalid category.');
    return value as ExpenseCategory;
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

function optionalCalendarDate(payload: Record<string, unknown>, field: string): string | null {
    const value = payload[field];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || !isCalendarDate(value)) throw new Error(`Invalid ${field}.`);
    return value;
}

function isCalendarDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
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

function requiredPositiveNumber(payload: Record<string, unknown>, field: string): number {
    const value = payload[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${field}.`);
    return value;
}

function requiredCalendarDateTime(payload: Record<string, unknown>, field: string): string {
    const value = requiredString(payload, field);
    if (Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${field}.`);
    return value;
}

function optionalCalendarDateTime(payload: Record<string, unknown>, field: string): string | undefined {
    const value = payload[field];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${field}.`);
    return value;
}

function requiredRecurringDateTime(payload: Record<string, unknown>, field: string): string {
    const value = requiredString(payload, field);
    if (!isValidRecurringDateTime(value)) throw new Error(`Invalid ${field}.`);
    return value;
}

function optionalRecurringDateTime(payload: Record<string, unknown>, field: string): string | undefined {
    const value = payload[field];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !isValidRecurringDateTime(value)) throw new Error(`Invalid ${field}.`);
    return value;
}

function isValidRecurringDateTime(value: string): boolean {
    const datePart = /^(\d{4}-\d{2}-\d{2})T/.exec(value)?.[1];
    return datePart !== undefined && isCalendarDate(datePart) && !Number.isNaN(Date.parse(value));
}
