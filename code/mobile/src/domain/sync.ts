export type SyncEntityType = "vehicle" | "fuel_entry" | "maintenance_entry";

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

export interface MaintenanceEntrySyncPayload extends EntrySyncPayload {
  type: string;
  description: string;
  cost: number;
}

export type RemoteChange =
  | {
      sequence: number;
      entityType: "vehicle";
      payload: VehicleSyncPayload;
    }
  | {
      sequence: number;
      entityType: "fuel_entry";
      payload: FuelEntrySyncPayload;
    }
  | {
      sequence: number;
      entityType: "maintenance_entry";
      payload: MaintenanceEntrySyncPayload;
    };

export interface PullResponse {
  data: RemoteChange[];
  nextCursor: number;
}
