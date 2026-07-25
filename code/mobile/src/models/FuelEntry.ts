export interface FuelEntry {
  id?: number;
  clientId?: string;
  vehicleId: number;
  date: string;
  liters: number;
  price: number;
  odometer: number;
}
