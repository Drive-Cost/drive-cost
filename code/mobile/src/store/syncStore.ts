import { create } from 'zustand';
import { SyncStatus } from '../services/sync/syncStatus';
import { subscribeToSyncStatus } from '../services/sync/syncService';

export const useSyncStore = create<SyncStatus>(() => ({ phase: 'offline', lastSyncedAt: null, error: null }));

subscribeToSyncStatus((status) => useSyncStore.setState(status));
