import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../../../src/screens/QuickAddOwnershipExpense/reducer';

describe('quick expense form', () => {
    it('preserves entered details through a failed save and allows correction', () => {
        let state = initialState('2026-10-09');
        state = reduce(state, { type: 'edit', field: 'category', value: 'insurance' });
        state = reduce(state, { type: 'edit', field: 'totalPaid', value: '480' });
        state = reduce(state, { type: 'showOptionalDetails' });
        state = reduce(state, { type: 'save' });
        expect(reduce(state, { type: 'edit', field: 'totalPaid', value: '100' })).toBe(state);
        expect(reduce(state, { type: 'save' })).toBe(state);
        state = reduce(state, { type: 'error', message: 'Try again.' });
        expect(state).toMatchObject({
            tag: 'editing',
            error: 'Try again.',
            showOptionalDetails: true,
            input: { category: 'insurance', totalPaid: '480' },
        });
        expect(reduce(state, { type: 'edit', field: 'totalPaid', value: '500' })).toMatchObject({
            error: null,
        });
    });

    it('accepts success only during saving and prevents editing completed submissions', () => {
        const initial = initialState('2026-10-09');
        expect(reduce(initial, { type: 'saved' })).toBe(initial);
        const saved = reduce(reduce(initial, { type: 'save' }), { type: 'saved' });
        expect(saved.tag).toBe('saved');
        expect(reduce(saved, { type: 'error', message: 'late failure' })).toBe(saved);
        expect(reduce(saved, { type: 'edit', field: 'totalPaid', value: '10' })).toBe(saved);
    });
});
