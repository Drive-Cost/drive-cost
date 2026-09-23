import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-sqlite', () => ({ openDatabaseSync: () => ({}) }));
import { ExpenseCategory } from '../../src/models/ExpenseEntry';
import { addRecurringExpense, deleteRecurringExpenseById, deleteRecurringExpenseFromSync, getRecurringExpenses, setRecurringExpenseActive, updateRecurringExpense, upsertRecurringExpenseFromSync } from '../../src/database/recurringExpenseRepository';

describe('recurring expense persistence', () => {
    it('creates, reads, updates, and deactivates a vehicle-scoped schedule with its stable identity', async () => {
        const commands: Array<{ sql: string; params: unknown[] }> = [];
        const database = {
            runAsync: async (sql: string, ...params: unknown[]) => { commands.push({ sql, params }); },
            getAllAsync: async (sql: string, ...params: unknown[]) => { commands.push({ sql, params }); return [{ id: 9, clientId: 'recurring-9', vehicleId: 1, category: ExpenseCategory.Insurance, amount: 480, periodMonths: 12, startDate: '2026-01-01', nextDueDate: null, description: null, active: 1 }]; },
            getFirstAsync: async (sql: string) => sql.includes('vehicles') ? { id: 1 } : ({ clientId: 'recurring-9' }),
        };
        const entry = { id: 9, clientId: 'recurring-9', vehicleId: 1, category: ExpenseCategory.Insurance, amount: 480, periodMonths: 12 as const, startDate: '2026-01-01', nextDueDate: '2027-01-01', description: 'Policy', active: true };
        await addRecurringExpense(entry, database as never);
        expect(await getRecurringExpenses(1, database as never)).toEqual([{ ...entry, nextDueDate: undefined, description: undefined }]);
        expect(await updateRecurringExpense({ ...entry, category: ExpenseCategory.Parking, amount: 25, nextDueDate: undefined }, database as never)).toMatchObject({ clientId: 'recurring-9', category: ExpenseCategory.Parking, amount: 25 });
        expect(await setRecurringExpenseActive(9, false, database as never)).toBe('recurring-9');
        expect(commands).toEqual(expect.arrayContaining([
            expect.objectContaining({ params: [1] }),
            expect.objectContaining({ params: ['recurring-9', 1, 'insurance', 480, 12, '2026-01-01', '2027-01-01', 'Policy', 1] }),
            expect.objectContaining({ params: [1, 'parking', 25, 12, '2026-01-01', null, 'Policy', 1, 9] }),
            expect.objectContaining({ params: [0, 9] }),
        ]));
    });

    it('upserts a pulled schedule by client ID and removes an explicitly deleted local schedule', async () => {
        const commands: Array<{ sql: string; params: unknown[] }> = [];
        const database = {
            runAsync: async (sql: string, ...params: unknown[]) => { commands.push({ sql, params }); },
            getFirstAsync: async (sql: string) => sql.includes('vehicles') ? { id: 7 } : ({ clientId: 'recurring-9' }),
        };
        const payload = {
            clientId: 'recurring-9', vehicleClientId: 'vehicle-7', category: ExpenseCategory.Insurance,
            amount: 480, periodMonths: 12 as const, startDate: '2026-01-01T00:00:00.000Z',
            nextDueDate: '2027-01-01T00:00:00.000Z', description: 'Policy', active: false,
        };

        await upsertRecurringExpenseFromSync(payload, database as never);
        await upsertRecurringExpenseFromSync({ ...payload, active: true }, database as never);
        await deleteRecurringExpenseFromSync(payload.clientId, database as never);
        await deleteRecurringExpenseFromSync(payload.clientId, database as never);
        await deleteRecurringExpenseById(9, database as never);

        expect(commands).toEqual(expect.arrayContaining([
            expect.objectContaining({ sql: expect.stringContaining('ON CONFLICT(clientId) DO UPDATE'), params: ['recurring-9', 7, 'insurance', 480, 12, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', 'Policy', 0] }),
            expect.objectContaining({ sql: 'DELETE FROM recurring_expenses WHERE id = ?', params: [9] }),
            expect.objectContaining({ sql: 'DELETE FROM recurring_expenses WHERE clientId = ?', params: ['recurring-9'] }),
        ]));
    });
});
