import { ExpenseCategory } from '../../models/ExpenseEntry';

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
    [ExpenseCategory.Insurance]: 'Insurance',
    [ExpenseCategory.Tax]: 'Vehicle tax',
    [ExpenseCategory.Inspection]: 'Inspection',
    [ExpenseCategory.Tolls]: 'Tolls',
    [ExpenseCategory.Parking]: 'Parking',
    [ExpenseCategory.CarWash]: 'Car wash',
    [ExpenseCategory.FinancingInterest]: 'Financing interest',
    [ExpenseCategory.Accessories]: 'Accessories',
    [ExpenseCategory.Other]: 'Other ownership expense',
};

export function getExpenseCategoryLabel(category: ExpenseCategory): string {
    return expenseCategoryLabels[category];
}
