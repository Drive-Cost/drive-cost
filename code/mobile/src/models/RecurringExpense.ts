import { ExpenseCategory, normalizeExpenseCategory } from './ExpenseEntry';

export const RecurringExpensePeriodMonths = [1, 3, 6, 12] as const;
export type RecurringExpensePeriodMonths = (typeof RecurringExpensePeriodMonths)[number];

export interface RecurringExpense {
    id?: number;
    clientId?: string;
    vehicleId: number;
    category: ExpenseCategory;
    amount: number;
    periodMonths: RecurringExpensePeriodMonths;
    startDate: string;
    nextDueDate?: string;
    description?: string;
    active: boolean;
}

export function isSupportedRecurringPeriod(value: unknown): value is RecurringExpensePeriodMonths {
    return RecurringExpensePeriodMonths.includes(value as RecurringExpensePeriodMonths);
}

export function normalizeRecurringExpense(entry: Omit<RecurringExpense, 'category' | 'periodMonths' | 'active'> & {
    category: unknown;
    periodMonths: unknown;
    active: unknown;
}): RecurringExpense {
    return {
        ...entry,
        category: normalizeExpenseCategory(entry.category),
        amount: Number.isFinite(entry.amount) ? entry.amount : 0,
        periodMonths: isSupportedRecurringPeriod(entry.periodMonths) ? entry.periodMonths : 1,
        startDate: entry.startDate,
        nextDueDate: entry.nextDueDate || undefined,
        description: entry.description || undefined,
        active: entry.active === true || entry.active === 1,
    };
}
