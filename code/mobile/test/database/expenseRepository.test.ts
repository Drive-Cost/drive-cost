import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { ExpenseCategory } from '../../src/models/ExpenseEntry';

vi.mock('expo-sqlite', () => ({
    openDatabaseSync: () => ({}),
}));

import {
    addExpenseEntry,
    deleteExpenseEntryById,
    getExpenseEntries,
    updateExpenseEntry,
} from '../../src/database/expenseRepository';

function fakeDatabase() {
    const commands: Array<{ sql: string; params: unknown[] }> = [];
    return {
        commands,
        runAsync: async (sql: string, ...params: unknown[]) => { commands.push({ sql, params }); },
        getAllAsync: async () => [{
            id: 3, clientId: 'expense-client-3', vehicleId: 1, category: ExpenseCategory.Insurance,
            totalPaid: 120, description: null, date: '2026-01-05', odometer: null,
        }],
        getFirstAsync: async () => ({ clientId: 'expense-client-3' }),
    };
}

describe('ownership expense persistence operations', () => {
    it('creates, reads, updates, and deletes while preserving the stable client id and optional odometer', async () => {
        const database = fakeDatabase();
        const entry = {
            id: 3, clientId: 'expense-client-3', vehicleId: 1, category: ExpenseCategory.Insurance,
            totalPaid: 120, description: 'Policy', date: '2026-01-05', odometer: 10_500,
        };

        await addExpenseEntry(entry, database as never);
        const read = await getExpenseEntries(1, database as never);
        const updated = await updateExpenseEntry({ ...entry, category: ExpenseCategory.Tax, totalPaid: 130, odometer: undefined }, database as never);
        const deletedClientId = await deleteExpenseEntryById(3, database as never);

        expect(read).toEqual([{ ...entry, description: undefined, odometer: undefined }]);
        expect(updated).toEqual({ ...entry, category: ExpenseCategory.Tax, totalPaid: 130, odometer: undefined });
        expect(deletedClientId).toBe('expense-client-3');
        expect(database.commands).toEqual(expect.arrayContaining([
            expect.objectContaining({ params: ['expense-client-3', 1, ExpenseCategory.Insurance, 120, 'Policy', '2026-01-05', 10_500] }),
            expect.objectContaining({ params: [1, ExpenseCategory.Tax, 130, 'Policy', '2026-01-05', null, 3] }),
            expect.objectContaining({ params: [3] }),
        ]));
    });
});
