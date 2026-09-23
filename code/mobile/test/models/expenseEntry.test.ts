import { describe, expect, it } from 'vitest';
import { ExpenseCategory, normalizeExpenseEntry } from '../../src/models/ExpenseEntry';

describe('ExpenseEntry normalization', () => {
    it('preserves a legacy row identity while giving unsupported categories a safe value', () => {
        expect(normalizeExpenseEntry({
            id: 7,
            clientId: 'legacy-expense-7',
            vehicleId: 4,
            category: 'old-category',
            totalPaid: 99,
            date: '2026-01-01',
            description: '',
            odometer: undefined,
        })).toEqual({
            id: 7,
            clientId: 'legacy-expense-7',
            vehicleId: 4,
            category: ExpenseCategory.Other,
            totalPaid: 99,
            date: '2026-01-01',
            description: undefined,
            odometer: undefined,
        });
    });
});
