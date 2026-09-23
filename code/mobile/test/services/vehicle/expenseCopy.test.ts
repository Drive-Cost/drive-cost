import { describe, expect, it } from 'vitest';
import { ExpenseCategory } from '../../../src/models/ExpenseEntry';
import { getExpenseCategoryLabel } from '../../../src/services/vehicle/expenseCopy';

describe('ownership expense presentation', () => {
    it('uses human-readable labels for every supported category', () => {
        expect(Object.values(ExpenseCategory).map(getExpenseCategoryLabel)).toEqual([
            'Insurance', 'Vehicle tax', 'Inspection', 'Tolls', 'Parking', 'Car wash', 'Financing interest', 'Accessories', 'Other ownership expense',
        ]);
    });
});
