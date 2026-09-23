import { RecurringExpensePeriodMonths } from '../../models/RecurringExpense';

export const recurrenceLabels: Record<RecurringExpensePeriodMonths, string> = {
    1: 'Monthly',
    3: 'Every 3 months',
    6: 'Every 6 months',
    12: 'Yearly',
};

export function recurrenceAmountLabel(periodMonths: RecurringExpensePeriodMonths): string {
    return periodMonths === 1 ? 'per month' : `every ${periodMonths} months`;
}
