import { describe, expect, it, vi } from 'vitest';
import { completeQuickAdd } from '../../src/navigation/completeQuickAdd';

describe('completeQuickAdd', () => {
    it('closes the action flow and uses Home as the deterministic primary-context fallback', () => {
        const reset = vi.fn();

        completeQuickAdd({ reset } as never);

        expect(reset).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'PrimaryTabs', params: { screen: 'Home' } }],
        });
    });
});
