export type SyncPhase = 'local-only' | 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncStatus {
    phase: SyncPhase;
    lastSyncedAt: string | null;
    error: string | null;
}

type SyncStatusListener = (status: SyncStatus) => void;

export function createSyncStatus(initialPhase: SyncPhase) {
    let status: SyncStatus = { phase: initialPhase, lastSyncedAt: null, error: null };
    const listeners = new Set<SyncStatusListener>();

    return {
        get: () => status,
        update: (next: Partial<SyncStatus>) => {
            status = { ...status, ...next };
            for (const listener of listeners) listener(status);
        },
        subscribe: (listener: SyncStatusListener) => {
            listeners.add(listener);
            listener(status);
            return () => listeners.delete(listener);
        },
    };
}
