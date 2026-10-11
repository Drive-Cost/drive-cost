import type { CreateRecordInput, UpdateRecordInput } from './record';
export type ChargingEntry = {
  id: number;
  clientId: string;
  vehicleId: number;
  date: string;
  kWh: number;
  price: number;
  odometer: number;
};

export type CreateChargingEntryInput = CreateRecordInput<ChargingEntry>;
export type UpdateChargingEntryInput = UpdateRecordInput<ChargingEntry>;
