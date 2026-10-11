import type { CreateRecordInput, UpdateRecordInput, StoredIdentity } from './record';
import { FuelFillStatus as SharedFuelFillStatus } from '@drivecost/contracts';

export const FuelFillStatus = SharedFuelFillStatus;
export type FuelFillStatus = (typeof FuelFillStatus)[keyof typeof FuelFillStatus];

export type FuelEntry = {
  id: number;
  clientId: string;
  vehicleId: number;
  date: string;
  liters: number;
  price: number;
  odometer: number;
  fillStatus: FuelFillStatus;
};

export function normalizeFuelFillStatus(value: unknown): FuelFillStatus {
  if (value === FuelFillStatus.Full || value === FuelFillStatus.Partial || value === FuelFillStatus.Unknown) {
    return value;
  }
  return FuelFillStatus.Unknown;
}

export function normalizeFuelEntry<
  Row extends Omit<FuelEntry, 'id' | 'clientId' | 'fillStatus'> & StoredIdentity & { fillStatus?: unknown },
>(entry: Row): Omit<Row, 'fillStatus'> & { fillStatus: FuelFillStatus } {
  return { ...entry, fillStatus: normalizeFuelFillStatus(entry.fillStatus) };
}

export type CreateFuelEntryInput = CreateRecordInput<FuelEntry>;
export type UpdateFuelEntryInput = UpdateRecordInput<FuelEntry>;
