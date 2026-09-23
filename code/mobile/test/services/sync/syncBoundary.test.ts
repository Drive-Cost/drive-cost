import { describe, expect, it } from 'vitest';
import { resolveSyncBoundary } from '../../../src/services/sync/syncBoundary';

const owner = { userId: 'user_a', mode: 'registered' as const };
const session = {
    userId: 'user_a', mode: 'registered' as const, accessToken: 'access',
    accessTokenExpiresAt: '2026-09-13T12:00:00.000Z', refreshToken: 'refresh',
};

describe('resolveSyncBoundary', () => {
    it('keeps fresh and unbound installations local-only even when an API is configured', () => {
        expect(resolveSyncBoundary(true, null, null, 'local-only')).toBe('local-only');
        expect(resolveSyncBoundary(false, owner, session, 'authenticated')).toBe('local-only');
    });

    it('permits sync only for a matching bound session', () => {
        expect(resolveSyncBoundary(true, owner, session, 'authenticated')).toBe('authenticated');
        expect(resolveSyncBoundary(true, owner, null, 'reauth-required')).toBe('reauth-required');
    });

    it('blocks a different cloud identity without replacing the persisted owner', () => {
        expect(resolveSyncBoundary(true, owner, { ...session, userId: 'user_b' }, 'authenticated')).toBe('account-mismatch');
        expect(resolveSyncBoundary(true, owner, session, 'account-mismatch')).toBe('account-mismatch');
    });
});
