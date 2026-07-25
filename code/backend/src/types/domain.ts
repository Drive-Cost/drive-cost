export interface UserRecord {
  id: string;
  mode: "guest" | "registered";
  email?: string;
  passwordHash?: string;
  createdAt: string;
}

export interface AuthenticatedUser {
  sub: string;
  mode: UserRecord["mode"];
  email?: string;
}

export interface SyncedRecord {
  id: string;
  clientId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export type SyncedVehicleRecord = SyncedRecord;
export type SyncedFuelEntryRecord = SyncedRecord;
export type SyncedMaintenanceEntryRecord = SyncedRecord;

export interface DatabaseShape {
  users: UserRecord[];
  syncChanges: SyncChange[];
  vehicles: SyncedVehicleRecord[];
  fuelEntries: SyncedFuelEntryRecord[];
  maintenanceEntries: SyncedMaintenanceEntryRecord[];
}

export interface SyncChange {
  sequence: number;
  userId: string;
  entityType: "vehicle" | "fuel_entry" | "maintenance_entry";
  entityId: string;
  clientId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
