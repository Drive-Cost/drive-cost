export interface VehicleSyncInput {
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

export const vehicleSyncSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "clientId",
    "brand",
    "model",
    "year",
    "ownershipStartMileage",
    "trackingStartMileage",
    "currentOdometer",
  ],
  properties: {
    clientId: { type: "string", minLength: 1, maxLength: 128 },
    brand: { type: "string", minLength: 1, maxLength: 80 },
    model: { type: "string", minLength: 1, maxLength: 100 },
    year: { type: "integer", minimum: 1886, maximum: 2100 },
    label: { type: "string", maxLength: 80 },
    fuelType: { type: "string", maxLength: 40 },
    engine: { type: "string", maxLength: 80 },
    powerHp: { type: "integer", minimum: 1, maximum: 3000 },
    transmission: { type: "string", maxLength: 40 },
    ownershipStartMileage: { type: "integer", minimum: 0 },
    trackingStartMileage: { type: "integer", minimum: 0 },
    currentOdometer: { type: "integer", minimum: 0 },
  },
} as const;
