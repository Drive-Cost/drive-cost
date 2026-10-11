import type { CreateRecordInput, UpdateRecordInput, StoredIdentity } from './record';
export const ExpenseCategory = {
  Insurance: 'insurance',
  Tax: 'tax',
  Inspection: 'inspection',
  Tolls: 'tolls',
  Parking: 'parking',
  CarWash: 'carWash',
  FinancingInterest: 'financingInterest',
  Accessories: 'accessories',
  Other: 'other',
} as const;

export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export type ExpenseEntry = {
  id: number;
  clientId: string;
  vehicleId: number;
  date: string;
  category: ExpenseCategory;
  totalPaid: number;
  description?: string;
  odometer?: number;
};

export function normalizeExpenseCategory(value: unknown): ExpenseCategory {
  return Object.values(ExpenseCategory).includes(value as ExpenseCategory)
    ? (value as ExpenseCategory)
    : ExpenseCategory.Other;
}

export function normalizeExpenseEntry<
  Row extends Omit<ExpenseEntry, 'id' | 'clientId' | 'category' | 'description' | 'odometer'> &
    StoredIdentity & { category: unknown; description?: string | null; odometer?: number | null },
>(
  entry: Row
): Omit<Row, 'category' | 'description' | 'odometer' | 'totalPaid'> &
  Pick<ExpenseEntry, 'category' | 'description' | 'odometer' | 'totalPaid'> {
  return {
    ...entry,
    category: normalizeExpenseCategory(entry.category),
    totalPaid: Number.isFinite(entry.totalPaid) ? entry.totalPaid : 0,
    description: entry.description || undefined,
    odometer: typeof entry.odometer === 'number' && Number.isFinite(entry.odometer) ? entry.odometer : undefined,
  };
}

export type CreateExpenseEntryInput = CreateRecordInput<ExpenseEntry>;
export type UpdateExpenseEntryInput = UpdateRecordInput<ExpenseEntry>;
