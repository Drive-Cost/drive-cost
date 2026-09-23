import { FuelFillStatus } from '@drivecost/contracts';
import { ExpenseCategory } from '@drivecost/contracts';

export type {
    ChargingEntrySyncPayload as ChargingEntrySyncInput,
    FuelEntrySyncPayload as FuelEntrySyncInput,
    MaintenanceEntrySyncPayload as MaintenanceEntrySyncInput,
} from '@drivecost/contracts';

const entryBaseProperties = {
    clientId: { type: 'string', minLength: 1, maxLength: 128 },
    vehicleClientId: { type: 'string', minLength: 1, maxLength: 128 },
    date: { type: 'string', format: 'date-time' },
    odometer: { type: 'integer', minimum: 0 },
} as const;

export const fuelEntrySyncSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['clientId', 'vehicleClientId', 'date', 'liters', 'price', 'odometer'],
    properties: {
        ...entryBaseProperties,
        liters: { type: 'number', exclusiveMinimum: 0 },
        price: { type: 'number', minimum: 0 },
        fillStatus: { type: 'string', enum: Object.values(FuelFillStatus) },
    },
} as const;

export const chargingEntrySyncSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['clientId', 'vehicleClientId', 'date', 'kWh', 'price', 'odometer'],
    properties: {
        ...entryBaseProperties,
        kWh: { type: 'number', exclusiveMinimum: 0 },
        price: { type: 'number', minimum: 0 },
    },
} as const;

export const maintenanceEntrySyncSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['clientId', 'vehicleClientId', 'date', 'type', 'description', 'cost', 'odometer'],
    properties: {
        ...entryBaseProperties,
        type: { type: 'string', minLength: 1, maxLength: 80 },
        description: { type: 'string', maxLength: 1000 },
        cost: { type: 'number', minimum: 0 },
    },
} as const;

export const expenseEntrySyncSchema = {
    type: 'object', additionalProperties: false,
    required: ['clientId', 'vehicleClientId', 'date', 'category', 'totalPaid'],
    properties: {
        clientId: { type: 'string', minLength: 1, maxLength: 128 },
        vehicleClientId: { type: 'string', minLength: 1, maxLength: 128 },
        date: { type: 'string', format: 'date-time' },
        category: { type: 'string', enum: Object.values(ExpenseCategory) },
        totalPaid: { type: 'number', exclusiveMinimum: 0 },
        description: { type: 'string', maxLength: 1000 },
        odometer: { type: 'integer', minimum: 0 },
    },
} as const;

export const recurringExpenseSyncSchema = {
    type: 'object', additionalProperties: false,
    required: ['clientId', 'vehicleClientId', 'category', 'amount', 'periodMonths', 'startDate', 'active'],
    properties: {
        clientId: { type: 'string', minLength: 1, maxLength: 128 }, vehicleClientId: { type: 'string', minLength: 1, maxLength: 128 },
        category: { type: 'string', enum: Object.values(ExpenseCategory) }, amount: { type: 'number', exclusiveMinimum: 0 },
        periodMonths: { type: 'integer', enum: [1, 3, 6, 12] }, startDate: { type: 'string', format: 'date-time' },
        nextDueDate: { type: 'string', format: 'date-time' }, description: { type: 'string', maxLength: 1000 }, active: { type: 'boolean' },
    },
} as const;
