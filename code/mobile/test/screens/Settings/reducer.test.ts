import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../../../src/screens/Settings/reducer';

describe('account details state', () => {
    it('distinguishes a successful local-only result from loading or failure', () => {
        expect(initialState.tag).toBe('loading');
        expect(reduce(initialState, { type: 'loaded', owner: null })).toEqual({ tag: 'ready', owner: null });
        expect(reduce(initialState, { type: 'failed' })).toEqual({ tag: 'error', owner: null });
    });
    it('preserves a bound owner and allows a failed load to be retried', () => {
        const owner = { userId: 'user_1', mode: 'registered' as const };
        const loaded = reduce(initialState, { type: 'loaded', owner });
        expect(loaded).toEqual({ tag: 'ready', owner });
        expect(reduce(loaded, { type: 'failed' })).toBe(loaded);
        const retry = reduce(reduce(initialState, { type: 'failed' }), { type: 'load' });
        expect(reduce(retry, { type: 'loaded', owner })).toEqual(loaded);
    });
});
