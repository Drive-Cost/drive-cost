import { deleteSyncJob, getSyncJobs, markSyncJobError } from '../../database/syncRepository';
import { decodeSyncPayload, SyncEntityType } from '../../domain/sync';
import { apiClient } from './apiClient';
import { clearAuthSession, initializeAuthSession } from './authSession';
import { pullRemoteChanges } from './pullSync/pullSync';
import { createSyncStatus, SyncStatus } from './syncStatus';

let activeSync: Promise<void> | null = null;
const remoteChangeListeners = new Set<(appliedChanges: number) => Promise<void>>();
const syncStatus = createSyncStatus(apiClient.isConfigured ? 'offline' : 'local-only');

async function syncJob(job: { entityType: SyncEntityType; payload: string }): Promise<void> {
    await apiClient.sync(job.entityType, decodeSyncPayload(job.entityType, parseSyncPayload(job.payload)));
}

function parseSyncPayload(payload: string): unknown {
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        throw new Error('A queued sync payload is invalid.');
    }
}

async function syncQueue() {
    if (!apiClient.isConfigured) {
        syncStatus.update({ phase: 'local-only', error: null });
        return;
    }

    if (!apiClient.hasSession()) {
        syncStatus.update({ phase: 'offline', error: null });
        return;
    }

    syncStatus.update({ phase: 'syncing', error: null });

    const jobs = await getSyncJobs();
    let jobError: Error | null = null;

    for (const job of jobs) {
        const jobId = job.id;
        if (jobId === undefined) continue;

        try {
            await syncJob(job);
            await deleteSyncJob(jobId);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown sync error';
            await markSyncJobError({ id: jobId, retryCount: job.retryCount }, message);
            if (isUnauthorized(error)) {
                await clearAuthSession();
            }
            jobError = new Error(message);
            break;
        }
    }

    const appliedChanges = await pullRemoteChanges();
    if (appliedChanges > 0) {
        await Promise.all([...remoteChangeListeners].map((listener) => listener(appliedChanges)));
    }

    if (jobError) throw jobError;

    syncStatus.update({ phase: 'synced', lastSyncedAt: new Date().toISOString(), error: null });
}

function isUnauthorized(error: unknown): boolean {
    return error instanceof Error && 'status' in error && error.status === 401;
}

export function subscribeToRemoteChanges(listener: (appliedChanges: number) => Promise<void>): () => void {
    remoteChangeListeners.add(listener);
    return () => remoteChangeListeners.delete(listener);
}

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void): () => void {
    return syncStatus.subscribe(listener);
}

export async function syncDevice(): Promise<void> {
    try {
        await initializeAuthSession();
    } catch {
        // Syncing below exposes a recoverable offline status without blocking local use.
    }

    return processSyncQueue();
}

export function processSyncQueue(): Promise<void> {
    if (!activeSync) {
        activeSync = syncQueue()
            .catch((error) => {
                const message = error instanceof Error ? error.message : 'Unknown sync error';
                syncStatus.update({ phase: 'error', error: message });
                throw error;
            })
            .finally(() => {
                activeSync = null;
            });
    }

    return activeSync;
}
