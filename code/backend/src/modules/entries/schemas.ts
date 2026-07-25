interface EntryBase {
  clientId: string;
  vehicleClientId: string;
  date: string;
  price: number;
  odometer: number;
}

export interface FuelEntrySyncInput extends EntryBase {
  liters: number;
}

export interface MaintenanceEntrySyncInput extends EntryBase {
  type: string;
  description: string;
  cost: number;
}

const entryBaseProperties = {
  clientId: { type: "string", minLength: 1, maxLength: 128 },
  vehicleClientId: { type: "string", minLength: 1, maxLength: 128 },
  date: { type: "string", format: "date-time" },
  odometer: { type: "integer", minimum: 0 },
} as const;

export const fuelEntrySyncSchema = {
  type: "object",
  additionalProperties: false,
  required: ["clientId", "vehicleClientId", "date", "liters", "price", "odometer"],
  properties: {
    ...entryBaseProperties,
    liters: { type: "number", exclusiveMinimum: 0 },
    price: { type: "number", minimum: 0 },
  },
} as const;

export const maintenanceEntrySyncSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "clientId",
    "vehicleClientId",
    "date",
    "type",
    "description",
    "cost",
    "odometer",
  ],
  properties: {
    ...entryBaseProperties,
    type: { type: "string", minLength: 1, maxLength: 80 },
    description: { type: "string", maxLength: 1000 },
    cost: { type: "number", minimum: 0 },
  },
} as const;
