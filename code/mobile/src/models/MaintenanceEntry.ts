export interface MaintenanceEntry {
  id?: number;
  clientId?: string;
  vehicleId: number;
  type: string;
  description: string;
  cost: number;
  date: string;
  odometer: number;
}
