import { describe, expect, it } from 'vitest';
import { recurrenceAmountLabel, recurrenceLabels } from '../../../src/services/vehicle/recurringExpenseCopy';

describe('recurring expense presentation', () => {
    it('uses clear human recurrence labels without payment wording', () => {
        expect(recurrenceLabels).toEqual({ 1: 'Monthly', 3: 'Every 3 months', 6: 'Every 6 months', 12: 'Yearly' });
        expect(recurrenceAmountLabel(12)).toBe('every 12 months');
        expect(Object.values(recurrenceLabels).join(' ')).not.toMatch(/total paid/i);
    });
});
