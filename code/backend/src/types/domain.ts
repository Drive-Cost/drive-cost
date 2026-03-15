export interface UserRecord {
  id: string;
  mode: "guest";
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  mode: "guest";
  createdAt: string;
}

export interface SyncedVehicleRecord {
  id: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface SyncedFuelEntryRecord {
  id: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface SyncedMaintenanceEntryRecord {
  id: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface DatabaseShape {
  users: UserRecord[];
  sessions: SessionRecord[];
  vehicles: SyncedVehicleRecord[];
  fuelEntries: SyncedFuelEntryRecord[];
  maintenanceEntries: SyncedMaintenanceEntryRecord[];
}
