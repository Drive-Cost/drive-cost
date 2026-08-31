import { describe, expect, it } from 'vitest';
import { createSyncStatus } from '../../../src/services/sync/syncStatus';

describe('createSyncStatus', () => {
    it('immediately publishes the current state and preserves fields across updates', () => {
        const syncStatus = createSyncStatus('offline');
        const observed: string[] = [];

        const unsubscribe = syncStatus.subscribe((status) => {
            observed.push(`${status.phase}:${status.error ?? 'none'}`);
        });

        syncStatus.update({ phase: 'error', error: 'Request failed' });
        syncStatus.update({ phase: 'syncing', error: null });
        unsubscribe();
        syncStatus.update({ phase: 'synced', lastSyncedAt: '2026-07-26T12:00:00.000Z' });

        expect(observed).toEqual(['offline:none', 'error:Request failed', 'syncing:none']);
        expect(syncStatus.get()).toEqual({ phase: 'synced', error: null, lastSyncedAt: '2026-07-26T12:00:00.000Z' });
    });
});
