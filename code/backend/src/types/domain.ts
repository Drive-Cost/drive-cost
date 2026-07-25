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
  vehicles: SyncedVehicleRecord[];
  fuelEntries: SyncedFuelEntryRecord[];
  maintenanceEntries: SyncedMaintenanceEntryRecord[];
}
