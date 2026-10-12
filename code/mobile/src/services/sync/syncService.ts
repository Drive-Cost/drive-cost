import { getDatasetGeneration, isDatasetCurrent, isAccountContextBlocked } from '../app/datasetContext';
import { db } from '../../database/db';
import { pushAdoptedData } from '../account/pushAdoptedData';
import { canSyncOwner } from './syncAccess';
import {
  deleteSyncJob,
  getSyncJobs,
  getPendingSyncError,
  markSyncJobError,
  SyncJob,
} from '../../database/syncRepository';
import { decodeSyncOperation, decodeSyncPayload } from '../../domain/sync';
import { apiClient } from './apiClient';
import { initializeAuthSession } from './authSession';
import { pullRemoteChanges } from './pullSync/pullSync';
import { createSyncStatus, SyncStatus } from './syncStatus';
import { getMobileSession, getMobileSessionState } from './authSession';
import { getSyncOwner } from '../../database/syncStateRepository';
import { resolveSyncBoundary } from './syncBoundary';
import { createSyncScheduler } from './syncScheduler';

const remoteChangeListeners = new Set<(appliedChanges: number) => Promise<void>>();
const syncStatus = createSyncStatus(apiClient.isConfigured ? 'offline' : 'local-only');

async function syncJob(job: SyncJob): Promise<void> {
  const operation = decodeSyncOperation(job.entityType, job.operation);
  await apiClient.sync(
    job.entityType,
    operation,
    decodeSyncPayload(job.entityType, operation, parseSyncPayload(job.payload))
  );
}

function parseSyncPayload(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new Error('A queued sync payload is invalid.');
  }
}

async function syncQueue() {
  const generation = getDatasetGeneration();
  const update = (status: Partial<SyncStatus>) => {
    if (isDatasetCurrent(generation)) publishStatus(status);
  };
  const owner = await getSyncOwner();
  const session = getMobileSession();
  const boundary = resolveSyncBoundary(apiClient.isConfigured, owner, session, getMobileSessionState());
  if (boundary === 'deletion-pending' || boundary === 'account-unavailable') {
    update({ phase: boundary, error: null });
    return;
  }
  if (boundary === 'local-only' || !owner) {
    update({ phase: 'local-only', error: null });
    return;
  }
  if (boundary === 'account-mismatch') {
    update({ phase: 'account-mismatch', error: null });
    return;
  }
  if (boundary === 'reauth-required' || !session || !apiClient.hasSession()) {
    update({ phase: 'auth-required', error: null });
    return;
  }

  if (!(await canSyncOwner(owner.userId))) {
    update({ phase: 'auth-required', error: null });
    return;
  }
  update({ phase: 'syncing', error: null });
  try {
    if (!(await pushAdoptedData(owner.userId))) {
      update({ phase: 'auth-required', error: null });
      return;
    }
  } catch (error) {
    if (!(await canSyncOwner(owner.userId))) {
      update({ phase: 'auth-required', error: null });
      return;
    }
    throw error;
  }

  const jobs = await getSyncJobs();
  let jobError: Error | null = null;

  for (const job of jobs) {
    const jobId = job.id;
    if (jobId === undefined) continue;

    try {
      if (!(await canSyncOwner(owner.userId))) {
        update({ phase: 'auth-required', error: null });
        return;
      }
      await syncJob(job);
      if (!(await canSyncOwner(owner.userId))) {
        update({ phase: 'auth-required', error: null });
        return;
      }
      await db.withExclusiveTransactionAsync(async transaction => {
        if (!isDatasetCurrent(generation) || !(await canSyncOwner(owner.userId, transaction))) return;
        await deleteSyncJob(jobId, transaction);
        if (!isDatasetCurrent(generation) || !(await canSyncOwner(owner.userId, transaction))) {
          throw new Error('Sync is paused.');
        }
      });
    } catch (error) {
      if (!isDatasetCurrent(generation)) return;
      if (!(await canSyncOwner(owner.userId))) {
        update({
          phase: getMobileSessionState() === 'account-mismatch' ? 'account-mismatch' : 'auth-required',
          error: null,
        });
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      await markSyncJobError({ id: jobId, retryCount: job.retryCount }, message);

      jobError = new Error(message);
      break;
    }
  }

  if (getMobileSessionState() === 'reauth-required') {
    update({ phase: 'auth-required', error: null });
    return;
  }
  if (getMobileSessionState() === 'account-mismatch') {
    update({ phase: 'account-mismatch', error: null });
    return;
  }

  let appliedChanges = 0;
  try {
    appliedChanges = await pullRemoteChanges(owner.userId);
  } catch (error) {
    if (getMobileSessionState() === 'reauth-required') {
      update({ phase: 'auth-required', error: null });
      return;
    }
    if (getMobileSessionState() === 'account-mismatch') {
      update({ phase: 'account-mismatch', error: null });
      return;
    }
    throw error;
  }
  if (!isDatasetCurrent(generation) || !(await canSyncOwner(owner.userId))) return;
  if (appliedChanges > 0) {
    await Promise.all([...remoteChangeListeners].map(listener => listener(appliedChanges)));
  }

  if (jobError) throw jobError;
  const pendingError = await getPendingSyncError();
  if (pendingError !== null) throw new Error(pendingError);

  if (!(await canSyncOwner(owner.userId))) {
    update({ phase: 'auth-required', error: null });
    return;
  }
  update({ phase: 'synced', lastSyncedAt: new Date().toISOString(), error: null });
}

export function subscribeToRemoteChanges(listener: (appliedChanges: number) => Promise<void>): () => void {
  remoteChangeListeners.add(listener);
  return () => remoteChangeListeners.delete(listener);
}

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void): () => void {
  return syncStatus.subscribe(listener);
}

export function showSignedOut(): void {
  publishStatus({ phase: 'auth-required', error: null });
}

export async function syncDevice(): Promise<void> {
  await (await import('../account/accountDeletion')).restoreAccountDeletion();
  try {
    await initializeAuthSession();
  } catch {
    // Syncing below exposes a recoverable offline status without blocking local use.
  }

  return processSyncQueue();
}

export function processSyncQueue(): Promise<void> {
  return syncScheduler.request();
}

const syncScheduler = createSyncScheduler(async () => {
  const generation = getDatasetGeneration();
  try {
    await syncQueue();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    if (isDatasetCurrent(generation)) publishStatus({ phase: 'error', error: message });
    throw error;
  }
});

function publishStatus(status: Partial<SyncStatus>): void {
  if (isAccountContextBlocked()) {
    syncStatus.update({
      phase: getMobileSessionState() === 'account-unavailable' ? 'account-unavailable' : 'deletion-pending',
      error: null,
    });
    return;
  }
  syncStatus.update(status);
}
export function showAccountDeletion(): void {
  publishStatus({ phase: 'deletion-pending', error: null });
}
export function showLocalOnly(): void {
  syncStatus.update({ phase: 'local-only', error: null, lastSyncedAt: null });
}
