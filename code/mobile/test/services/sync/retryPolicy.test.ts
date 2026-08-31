import { describe, expect, it } from 'vitest';
import { nextRetryAt } from '../../../src/services/sync/retryPolicy';

const START_TIME = Date.UTC(2026, 7, 31, 12, 0, 0);

describe('nextRetryAt', () => {
    it('Given a first failed job, when scheduling a retry, then waits for the initial backoff period', () => {
        expect(nextRetryAt(1, START_TIME)).toBe('2026-08-31T12:00:30.000Z');
    });

    it('Given repeated failures, when scheduling a retry, then caps exponential backoff', () => {
        expect(nextRetryAt(20, START_TIME)).toBe('2026-08-31T12:15:00.000Z');
    });
});
