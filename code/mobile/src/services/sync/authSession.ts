import * as SecureStore from 'expo-secure-store';
import { apiClient } from './apiClient';
import { bindSyncOwner, getSyncOwner } from '../../database/syncStateRepository';

const SESSION_KEY = 'drivecost.auth-session.v2';
const LEGACY_ACCESS_TOKEN_KEY = 'drivecost.access-token';
const REFRESH_SKEW_MS = 60_000;

export interface MobileSession {
    userId: string;
    mode: 'guest' | 'registered';
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    email?: string;
}

export type MobileSessionState = 'local-only' | 'authenticated' | 'reauth-required' | 'account-mismatch';

let session: MobileSession | null = null;
let state: MobileSessionState = 'local-only';
let activeRefresh: Promise<boolean> | null = null;

export function getMobileSession(): MobileSession | null {
    return session;
}

export function getMobileSessionState(): MobileSessionState {
    return state;
}

export async function persistMobileSession(response: { accessToken: string; refreshToken: string; accessTokenExpiresAt: string; user: { id: string; mode: 'guest' | 'registered'; email?: string } }): Promise<MobileSession> {
    const next = parseSession({ userId: response.user.id, mode: response.user.mode, accessToken: response.accessToken, accessTokenExpiresAt: response.accessTokenExpiresAt, refreshToken: response.refreshToken });
    if (!next) throw new Error('Invalid session response.');
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ ...next, email: response.user.email }));
    session = next;
    apiClient.setAccessToken(next.accessToken);
    state = 'authenticated';
    return next;
}

export async function initializeAuthSession(): Promise<MobileSessionState> {
    if (!apiClient.isConfigured) return setLocalOnly();
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    const restored = parseSession(stored);
    if (!restored) {
        await migrateLegacyAccessToken();
        return state;
    }
    session = restored;
    apiClient.setAccessToken(restored.accessToken);
    const owner = await getSyncOwner();
    if (owner && owner.userId !== restored.userId) {
        state = 'account-mismatch';
        apiClient.setAccessToken(null);
        return state;
    }
    state = 'authenticated';
    if (expiresSoon(restored.accessTokenExpiresAt)) await refreshAuthSession();
    return state;
}

export async function refreshAuthSession(): Promise<boolean> {
    if (!activeRefresh) activeRefresh = rotateSession().finally(() => { activeRefresh = null; });
    return activeRefresh;
}

export async function clearAuthSession(): Promise<void> {
    session = null;
    apiClient.setAccessToken(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    state = 'reauth-required';
}

async function rotateSession(): Promise<boolean> {
    if (!session) return false;
    try {
        const response = await apiClient.refresh(session.refreshToken);
        const next = parseSession({
            userId: response.user.id,
            mode: response.user.mode,
            accessToken: response.accessToken,
            accessTokenExpiresAt: response.accessTokenExpiresAt,
            refreshToken: response.refreshToken,
        });
        if (!next) throw new Error('Invalid refreshed session.');
        const owner = await getSyncOwner();
        if (owner && owner.userId !== next.userId) {
            state = 'account-mismatch';
            apiClient.setAccessToken(null);
            return false;
        }
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
        session = next;
        apiClient.setAccessToken(next.accessToken);
        state = 'authenticated';
        return true;
    } catch {
        await clearAuthSession();
        return false;
    }
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
    return state;
}

function parseSession(value: unknown): MobileSession | null {
    const parsed = typeof value === 'string' ? safeJson(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Record<string, unknown>;
    if (
        typeof candidate.userId !== 'string'
        || (candidate.mode !== 'guest' && candidate.mode !== 'registered')
        || typeof candidate.accessToken !== 'string'
        || typeof candidate.accessTokenExpiresAt !== 'string'
        || typeof candidate.refreshToken !== 'string'
        || Number.isNaN(Date.parse(candidate.accessTokenExpiresAt))
    ) return null;
    return {
        userId: candidate.userId,
        mode: candidate.mode,
        accessToken: candidate.accessToken,
        accessTokenExpiresAt: candidate.accessTokenExpiresAt,
        refreshToken: candidate.refreshToken,
        ...(typeof candidate.email === 'string' ? { email: candidate.email } : {}),
    } as MobileSession;
}

function safeJson(value: string): unknown {
    try { return JSON.parse(value); } catch { return null; }
}

function expiresSoon(expiresAt: string): boolean {
    return Date.parse(expiresAt) <= Date.now() + REFRESH_SKEW_MS;
}

function decodeLegacyIdentity(token: string): { userId: string; mode: 'guest' | 'registered' } | null {
    try {
        const payload = JSON.parse(globalThis.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
        return typeof payload.sub === 'string' && (payload.mode === 'guest' || payload.mode === 'registered')
            ? { userId: payload.sub, mode: payload.mode }
            : null;
    } catch { return null; }
}

apiClient.setRefreshHandler(refreshAuthSession);
