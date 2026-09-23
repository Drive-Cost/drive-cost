import { beforeEach, describe, expect, it, vi } from 'vitest';

const executed: string[] = [];

vi.mock('expo-sqlite', () => ({
    openDatabaseSync: () => ({
        execSync: (sql: string) => executed.push(sql),
        getAllSync: (sql: string) => {
            if (sql.includes('ownership_expenses')) return [{ name: 'id' }, { name: 'amount' }];
            return [{ name: 'id' }, { name: 'ownershipStartMileage' }, { name: 'trackingStartMileage' }, { name: 'currentOdometer' }, { name: 'clientId' }, { name: 'fillStatus' }, { name: 'retryCount' }, { name: 'nextAttemptAt' }];
        },
    }),
}));

import { initDatabase } from '../../src/database/db';

describe('ownership expense migration', () => {
    beforeEach(() => { executed.length = 0; });

    it('adds the DC-102 fields and preserves existing values and stable legacy identity', () => {
        initDatabase();

        expect(executed.join('\n')).toContain('ALTER TABLE ownership_expenses ADD COLUMN clientId TEXT');
        expect(executed.join('\n')).toContain('ALTER TABLE ownership_expenses ADD COLUMN totalPaid REAL');
        expect(executed.join('\n')).toContain('ALTER TABLE ownership_expenses ADD COLUMN odometer INTEGER');
        expect(executed.join('\n')).toContain("UPDATE ownership_expenses SET clientId = 'legacy-expense-' || id WHERE clientId IS NULL");
        expect(executed.join('\n')).toContain('SET totalPaid = COALESCE(totalPaid, amount)');
        expect(executed.join('\n')).toContain('ALTER TABLE vehicles ADD COLUMN trackingStartDate TEXT');
        expect(executed.join('\n')).toContain('CREATE TABLE IF NOT EXISTS recurring_expenses');
        expect(executed.join('\n')).toContain("UPDATE recurring_expenses SET clientId = 'legacy-recurring-expense-' || id WHERE clientId IS NULL");
        expect(executed.join('\n')).toContain('FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE');
    });
});
