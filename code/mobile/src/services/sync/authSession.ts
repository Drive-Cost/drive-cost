import {
  blockAccountContext,
  releaseAccountContext,
  isAccountContextBlocked,
  getDatasetGeneration,
  isDatasetCurrent,
} from '../app/datasetContext';
import * as SecureStore from 'expo-secure-store';
import { useAccountStore } from '../../store/accountStore';
import { SyncApiError, apiClient } from './apiClient';
import {
  bindSyncOwner,
  getSyncOwner,
  isSessionBlocked,
  getAccountLifecycleBlock,
  markAccountUnavailable,
} from '../../database/syncStateRepository';
import type { SessionResponse } from '../../domain/sync';

const SESSION_KEY = 'drivecost.auth-session.v2';
const LEGACY_ACCESS_TOKEN_KEY = 'drivecost.access-token';
const REFRESH_SKEW_MS = 60_000;

export type MobileSession = {
  userId: string;
  mode: 'guest' | 'registered';
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  email?: string;
};

export type MobileSessionState =
  | 'local-only'
  | 'authenticated'
  | 'reauth-required'
  | 'account-mismatch'
  | 'deletion-pending'
  | 'account-unavailable';

let session: MobileSession | null = null;
let state: MobileSessionState = 'local-only';
let activeRefresh: Promise<boolean> | null = null;
let pendingRotation: MobileSession | null = null;
let sessionGeneration = 0;
let secureWrite: Promise<void> = Promise.resolve();

function writeSecureSession(write: () => Promise<void>): Promise<void> {
  const pending = secureWrite.then(write);
  secureWrite = pending.catch(() => undefined);
  return pending;
}

function publishSession() {
  useAccountStore.setState({
    session: session ? { userId: session.userId, mode: session.mode, email: session.email } : null,
    status: state,
  });
}

export function getMobileSession(): MobileSession | null {
  return session;
}

export function getMobileSessionState(): MobileSessionState {
  return state;
}

export async function persistMobileSession(response: SessionResponse): Promise<MobileSession> {
  const dataset = getDatasetGeneration();
  if (isAccountContextBlocked() || (await getAccountLifecycleBlock()))
    throw new Error('Resolve account deletion in Settings.');
  if (!isDatasetCurrent(dataset) || isAccountContextBlocked()) throw new Error('Account context changed.');
  const next = parseSession({
    userId: response.user.id,
    mode: response.user.mode,
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    refreshToken: response.refreshToken,
    email: response.user.email,
  });
  if (!next) throw new Error('Invalid session response.');
  const generation = ++sessionGeneration;
  pendingRotation = null;
  await writeSecureSession(async () => {
    if (sessionGeneration === generation && !isAccountContextBlocked() && isDatasetCurrent(dataset))
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
  });
  if (sessionGeneration !== generation || isAccountContextBlocked() || (await getAccountLifecycleBlock()))
    throw new Error('Account context changed.');
  session = next;
  apiClient.setAccessToken(next.accessToken);
  pendingRotation = null;
  state = 'authenticated';
  publishSession();
  return next;
}

export async function initializeAuthSession(): Promise<MobileSessionState> {
  const generation = sessionGeneration;
  const blocked = await getAccountLifecycleBlock();
  if (blocked) {
    pauseAccountSession(blocked);
    return state;
  }
  if (isAccountContextBlocked() || sessionGeneration !== generation) return state;
  if (!apiClient.isConfigured) return setLocalOnly();
  if (await isSessionBlocked()) {
    await clearSignedOutSession();
    return state;
  }
  if (isAccountContextBlocked() || sessionGeneration !== generation) return state;
  if (state === 'reauth-required' && !session) return state;
  if (pendingRotation) await saveRotation();
  if (isAccountContextBlocked() || sessionGeneration !== generation) return state;
  if (!session) {
    const restored = parseSession(await SecureStore.getItemAsync(SESSION_KEY));
    if (isAccountContextBlocked() || sessionGeneration !== generation) return state;
    if (!restored) {
      await migrateLegacyAccessToken();
      publishSession();
      return state;
    }
    session = restored;
  }
  const restored = session;
  apiClient.setAccessToken(restored.accessToken);
  const owner = await getSyncOwner();
  if (isAccountContextBlocked() || sessionGeneration !== generation) return state;
  if (owner && owner.userId !== restored.userId) {
    state = 'account-mismatch';
    apiClient.setAccessToken(null);
    publishSession();
    return state;
  }
  if (owner?.mode === 'guest' && restored.mode === 'registered') {
    await bindSyncOwner({ userId: restored.userId, mode: restored.mode });
  }
  if (isAccountContextBlocked() || sessionGeneration !== generation) return state;
  state = 'authenticated';
  publishSession();
  if (expiresSoon(restored.accessTokenExpiresAt)) await refreshAuthSession();
  return state;
}

export async function refreshAuthSession(): Promise<boolean> {
  if (!activeRefresh)
    activeRefresh = rotateSession().finally(() => {
      activeRefresh = null;
    });
  return activeRefresh;
}

export async function clearAuthSession(): Promise<void> {
  sessionGeneration += 1;
  session = null;
  pendingRotation = null;
  apiClient.setAccessToken(null);
  if (!isAccountContextBlocked()) state = 'reauth-required';
  publishSession();
  await writeSecureSession(() => SecureStore.deleteItemAsync(SESSION_KEY));
}

/** Explicit sign-out removes retired credentials too; normal refresh recovery is unchanged. */
export async function clearSignedOutSession(): Promise<void> {
  await clearAuthSession();
  await writeSecureSession(() => SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY));
}

async function saveRotation(): Promise<void> {
  if (!pendingRotation) return;
  const next = pendingRotation;
  await writeSecureSession(async () => {
    if (pendingRotation === next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
  });
  if (pendingRotation !== next) return;
  session = next;
  pendingRotation = null;
  apiClient.setAccessToken(session.accessToken);
  state = 'authenticated';
  publishSession();
}

async function rotateSession(): Promise<boolean> {
  if (isAccountContextBlocked() || (await getAccountLifecycleBlock())) return false;
  if (isAccountContextBlocked()) return false;
  if (pendingRotation) {
    await saveRotation();
    return true;
  }
  if (!session) return false;
  const current = session;
  const generation = sessionGeneration;
  let response: SessionResponse;
  try {
    response = await apiClient.refresh(current.refreshToken);
  } catch (error) {
    if (session !== current || sessionGeneration !== generation) return false;
    if (error instanceof SyncApiError && error.status === 401) {
      await clearAuthSession();
      return false;
    }
    // Propagate outages so callers do not mistake an expired access token for
    // a rejected refresh credential. The stored session remains recoverable.
    throw error;
  }
  if (session !== current || sessionGeneration !== generation) return false;
  const next: MobileSession = {
    userId: response.user.id,
    mode: response.user.mode,
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    refreshToken: response.refreshToken,
    email: response.user.email ?? current.email,
  };
  if (next.userId !== current.userId) {
    state = 'account-mismatch';
    apiClient.setAccessToken(null);
    publishSession();
    return false;
  }
  pendingRotation = next;
  const owner = await getSyncOwner();
  if (session !== current || sessionGeneration !== generation) {
    if (pendingRotation === next) pendingRotation = null;
    return false;
  }
  if (owner && owner.userId !== next.userId) {
    pendingRotation = null;
    state = 'account-mismatch';
    apiClient.setAccessToken(null);
    publishSession();
    return false;
  }
  // Rotation has consumed the old secret. Retain its replacement in memory
  // until secure storage succeeds; retry storage before requesting another rotation.
  await saveRotation();
  return true;
}

async function migrateLegacyAccessToken(): Promise<void> {
  const legacyToken = await SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  if (!legacyToken) return;
  const legacyIdentity = decodeLegacyIdentity(legacyToken);
  if (legacyIdentity) {
    const owner = await getSyncOwner();
    if (!owner) await bindSyncOwner(legacyIdentity);
  }
  await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  state = 'reauth-required';
}

function setLocalOnly(): MobileSessionState {
  session = null;
  apiClient.setAccessToken(null);
  state = 'local-only';
  publishSession();
  return state;
}

function parseSession(value: unknown): MobileSession | null {
  const parsed = typeof value === 'string' ? safeJson(value) : value;
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.userId !== 'string' ||
    !candidate.userId ||
    (candidate.mode !== 'guest' && candidate.mode !== 'registered') ||
    typeof candidate.accessToken !== 'string' ||
    !candidate.accessToken ||
    typeof candidate.accessTokenExpiresAt !== 'string' ||
    typeof candidate.refreshToken !== 'string' ||
    !candidate.refreshToken ||
    Number.isNaN(Date.parse(candidate.accessTokenExpiresAt))
  )
    return null;
  return {
    userId: candidate.userId,
    mode: candidate.mode,
    accessToken: candidate.accessToken,
    accessTokenExpiresAt: candidate.accessTokenExpiresAt,
    refreshToken: candidate.refreshToken,
    ...(typeof candidate.email === 'string' ? { email: candidate.email } : {}),
  };
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function expiresSoon(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now() + REFRESH_SKEW_MS;
}

function decodeLegacyIdentity(token: string): { userId: string; mode: 'guest' | 'registered' } | null {
  try {
    const payload = JSON.parse(globalThis.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<
      string,
      unknown
    >;
    return typeof payload.sub === 'string' && (payload.mode === 'guest' || payload.mode === 'registered')
      ? { userId: payload.sub, mode: payload.mode }
      : null;
  } catch {
    return null;
  }
}

apiClient.setRefreshHandler(refreshAuthSession);

/** Fence refresh/persistence without deleting recoverable credentials during an unknown outcome. */
export function pauseAccountSession(reason: 'deletion-pending' | 'account-unavailable'): void {
  blockAccountContext();
  sessionGeneration += 1;
  pendingRotation = null;
  apiClient.setAccessToken(null);
  state = reason;
  publishSession();
}
export function completeAccountDeletion(): void {
  sessionGeneration += 1;
  pendingRotation = null;
  releaseAccountContext();
  setLocalOnly();
}
apiClient.setUnavailableHandler(async token => {
  if (!session || session.accessToken !== token || state !== 'authenticated') return;
  const ownerId = session.userId;
  pauseAccountSession('account-unavailable');
  await markAccountUnavailable(ownerId);
});

/** Freeze new refreshes while an existing rotation finishes, retaining the live guest proof. */
export async function pauseCurrentSessionForDeletion(): Promise<MobileSession> {
  blockAccountContext();
  try {
    if (activeRefresh) await activeRefresh;
    if (pendingRotation) await saveRotation();
    if (!session || state !== 'authenticated') throw new Error('Sign in before deleting your account.');
    const current = session;
    pauseAccountSession('deletion-pending');
    return current;
  } catch (error) {
    releaseAccountContext();
    if (!session) {
      state = 'reauth-required';
      publishSession();
    }
    throw error;
  }
}
