export interface MaintenanceEntry {
  id?: number;
  vehicleId: number;
  type: string;
  description: string;
  cost: number;
  date: string;
  odometer: number;
}
