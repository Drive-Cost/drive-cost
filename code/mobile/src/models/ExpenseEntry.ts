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

export interface ExpenseEntry {
    id?: number;
    clientId?: string;
    vehicleId: number;
    date: string;
    category: ExpenseCategory;
    totalPaid: number;
    description?: string;
    odometer?: number;
}

export function normalizeExpenseCategory(value: unknown): ExpenseCategory {
    return Object.values(ExpenseCategory).includes(value as ExpenseCategory)
        ? (value as ExpenseCategory)
        : ExpenseCategory.Other;
}

export function normalizeExpenseEntry(entry: Omit<ExpenseEntry, 'category'> & { category: unknown }): ExpenseEntry {
    return {
        ...entry,
        category: normalizeExpenseCategory(entry.category),
        totalPaid: Number.isFinite(entry.totalPaid) ? entry.totalPaid : 0,
        description: entry.description || undefined,
        odometer: Number.isFinite(entry.odometer) ? entry.odometer : undefined,
    };
}
