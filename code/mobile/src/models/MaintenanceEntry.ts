import type { CreateRecordInput, UpdateRecordInput } from './record';
export type MaintenanceEntry = {
  id: number;
  clientId: string;
  vehicleId: number;
  type: string;
  description: string;
  cost: number;
  date: string;
  odometer: number;
};

export type CreateMaintenanceEntryInput = CreateRecordInput<MaintenanceEntry>;
export type UpdateMaintenanceEntryInput = UpdateRecordInput<MaintenanceEntry>;
