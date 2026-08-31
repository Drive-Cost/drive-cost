export type { VehicleSyncPayload as VehicleSyncInput } from '@drivecost/contracts';

const CLIENT_ID_MAX_LENGTH = 128;
const BRAND_MAX_LENGTH = 80;
const MODEL_MAX_LENGTH = 100;
const FIRST_AUTOMOBILE_YEAR = 1886;
const MAXIMUM_MODEL_YEAR = 2100;
const FUEL_TYPE_MAX_LENGTH = 40;
const ENGINE_MAX_LENGTH = 80;
const MAXIMUM_POWER_HP = 3000;

export const vehicleSyncSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
        'clientId',
        'brand',
        'model',
        'year',
        'ownershipStartMileage',
        'trackingStartMileage',
        'currentOdometer',
    ],
    properties: {
        clientId: { type: 'string', minLength: 1, maxLength: CLIENT_ID_MAX_LENGTH },
        brand: { type: 'string', minLength: 1, maxLength: BRAND_MAX_LENGTH },
        model: { type: 'string', minLength: 1, maxLength: MODEL_MAX_LENGTH },
        year: { type: 'integer', minimum: FIRST_AUTOMOBILE_YEAR, maximum: MAXIMUM_MODEL_YEAR },
        label: { type: 'string', maxLength: BRAND_MAX_LENGTH },
        fuelType: { type: 'string', maxLength: FUEL_TYPE_MAX_LENGTH },
        engine: { type: 'string', maxLength: ENGINE_MAX_LENGTH },
        powerHp: { type: 'integer', minimum: 1, maximum: MAXIMUM_POWER_HP },
        transmission: { type: 'string', maxLength: FUEL_TYPE_MAX_LENGTH },
        ownershipStartMileage: { type: 'integer', minimum: 0 },
        trackingStartMileage: { type: 'integer', minimum: 0 },
        currentOdometer: { type: 'integer', minimum: 0 },
    },
} as const;
