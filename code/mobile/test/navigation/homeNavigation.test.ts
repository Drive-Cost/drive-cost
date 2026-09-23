import { describe, expect, it } from 'vitest';
import { homeDestinations } from '../../src/navigation/homeNavigation';

describe('Home navigation', () => {
    it('uses the existing primary Add and History destinations', () => {
        expect(homeDestinations).toEqual({ quickAdd: 'Add', history: 'History' });
    });
});
