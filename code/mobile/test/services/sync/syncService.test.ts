import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEntity, SyncOperation } from '../../../src/domain/sync';

const mocks = vi.hoisted(() => ({
  getSyncJobs: vi.fn(),
  getPendingSyncError: vi.fn(),
  deleteSyncJob: vi.fn(),
  markSyncJobError: vi.fn(),
  sync: vi.fn(),
  pull: vi.fn(),
  sessionState: vi.fn(),
  clearAuthSession: vi.fn(),
}));
vi.mock('../../../src/database/syncRepository', () => ({
  getSyncJobs: mocks.getSyncJobs,
  getPendingSyncError: mocks.getPendingSyncError,
  deleteSyncJob: mocks.deleteSyncJob,
  markSyncJobError: mocks.markSyncJobError,
}));
vi.mock('../../../src/services/sync/apiClient', () => ({
  apiClient: {
    isConfigured: true,
    hasSession: () => true,
    sync: mocks.sync,
  },
}));
vi.mock('../../../src/services/sync/authSession', () => ({
  initializeAuthSession: vi.fn(),
  clearAuthSession: mocks.clearAuthSession,
  getMobileSession: () => ({ userId: 'user_1', mode: 'registered' }),
  getMobileSessionState: mocks.sessionState,
}));
vi.mock('../../../src/services/account/pushAdoptedData', () => ({ pushAdoptedData: async () => true }));
vi.mock('../../../src/database/syncStateRepository', () => ({
  isSessionBlocked: async () => false,
  getSyncOwner: async () => ({ userId: 'user_1', mode: 'registered' }),
}));
vi.mock('../../../src/services/sync/pullSync/pullSync', () => ({ pullRemoteChanges: mocks.pull }));

const payload = {
  clientId: 'vehicle_1',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2022,
  ownershipStartMileage: 1_000,
  trackingStartMileage: 1_000,
  currentOdometer: 1_200,
};
const job = {
  id: 1,
  entityType: SyncEntity.Vehicle,
  operation: SyncOperation.Upsert,
  payload: JSON.stringify(payload),
  createdAt: '2026-10-11T12:00:00.000Z',
};

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.sessionState.mockReturnValue('authenticated');
  mocks.getSyncJobs.mockResolvedValue([]);
  mocks.getPendingSyncError.mockResolvedValue(null);
  mocks.sync.mockResolvedValue(undefined);
  mocks.pull.mockResolvedValue(0);
});

describe('sync service scheduling and status', () => {
  it('processes new outbox jobs arriving during an active push without concurrent network passes', async () => {
    let release!: () => void;
    const inFlight = new Promise<void>(resolve => {
      release = resolve;
    });
    mocks.getSyncJobs.mockResolvedValueOnce([job]).mockResolvedValueOnce([{ ...job, id: 2 }]);
    mocks.sync.mockReturnValueOnce(inFlight);
    const { processSyncQueue } = await import('../../../src/services/sync/syncService');
    const pending = processSyncQueue();
    await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledOnce());
    expect(processSyncQueue()).toBe(pending);
    release();
    await pending;
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    expect(mocks.deleteSyncJob.mock.calls).toEqual([[1], [2]]);
  });

  it('preserves a recoverable error while failed jobs are waiting for their backoff', async () => {
    mocks.getPendingSyncError.mockResolvedValue('Service unavailable.');
    const { processSyncQueue, subscribeToSyncStatus } = await import('../../../src/services/sync/syncService');
    const phases: string[] = [];
    const unsubscribe = subscribeToSyncStatus(status => phases.push(status.phase));
    try {
      await expect(processSyncQueue()).rejects.toThrow('Service unavailable.');
      expect(phases.at(-1)).toBe('error');
      expect(phases).not.toContain('synced');
      expect(mocks.sync).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('leaves a failed job queued and records its retry before rejecting a manual sync', async () => {
    mocks.getSyncJobs.mockResolvedValueOnce([job]);
    mocks.sync.mockRejectedValueOnce(new Error('Offline.'));
    const { processSyncQueue } = await import('../../../src/services/sync/syncService');
    await expect(processSyncQueue()).rejects.toThrow('Offline.');
    expect(mocks.markSyncJobError).toHaveBeenCalledWith({ id: 1, retryCount: undefined }, 'Offline.');
    expect(mocks.deleteSyncJob).not.toHaveBeenCalled();
  });
  it('does not delete refresh credentials after a rejected access request', async () => {
    mocks.pull.mockRejectedValue(Object.assign(new Error('Unauthorized access token'), { status: 401 }));
    const { processSyncQueue } = await import('../../../src/services/sync/syncService');
    await expect(processSyncQueue()).rejects.toThrow('Unauthorized access token');
    expect(mocks.clearAuthSession).not.toHaveBeenCalled();
  });

  it('reports reauthentication when refresh already rejected the credential, without losing queued writes', async () => {
    mocks.getSyncJobs.mockResolvedValue([job]);
    mocks.sync.mockImplementation(async () => {
      mocks.sessionState.mockReturnValue('reauth-required');
      throw new Error('Refresh session expired');
    });
    const { processSyncQueue, subscribeToSyncStatus } = await import('../../../src/services/sync/syncService');
    const phases: string[] = [];
    const unsubscribe = subscribeToSyncStatus(status => phases.push(status.phase));
    await processSyncQueue();
    unsubscribe();
    expect(phases.at(-1)).toBe('auth-required');
    expect(mocks.deleteSyncJob).not.toHaveBeenCalled();
    expect(mocks.pull).not.toHaveBeenCalled();
  });
});
