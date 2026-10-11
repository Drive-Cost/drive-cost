import type { CreateRecordInput, UpdateRecordInput } from './record';
export type Vehicle = {
  id: number;
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
  trackingStartDate?: string | null;
  currentOdometer: number;
  currentMileage?: number;
};

export type CreateVehicleInput = CreateRecordInput<Vehicle>;
export type UpdateVehicleInput = UpdateRecordInput<Vehicle>;
