import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
const owner = vi.hoisted(() => ({ get: vi.fn(), bind: vi.fn(), blocked: vi.fn() }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: storage.get,
  setItemAsync: storage.set,
  deleteItemAsync: storage.remove,
}));
vi.mock('../../../src/database/syncStateRepository', () => ({
  getSyncOwner: owner.get,
  bindSyncOwner: owner.bind,
  isSessionBlocked: owner.blocked,
  getAccountLifecycleBlock: async () => null,
  markAccountUnavailable: vi.fn(),
}));

const response = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: 'user-1', mode: 'registered' as const, email: 'me@example.com' },
};

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://drivecost.test');
  storage.set.mockResolvedValue(undefined);
  storage.remove.mockResolvedValue(undefined);
  owner.blocked.mockResolvedValue(false);
  owner.get.mockResolvedValue({ userId: 'user-1', mode: 'registered' });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup() {
  const auth = await import('../../../src/services/sync/authSession');
  const { apiClient, SyncApiError } = await import('../../../src/services/sync/apiClient');
  const { useAccountStore } = await import('../../../src/store/accountStore');
  await auth.persistMobileSession(response);
  return { auth, apiClient, SyncApiError, useAccountStore };
}

describe('recoverable mobile sessions', () => {
  it.each([new TypeError('Offline'), new Error('Timed out')])(
    'keeps credentials through %s and retries',
    async error => {
      const { auth, apiClient } = await setup();
      const refresh = vi.spyOn(apiClient, 'refresh').mockRejectedValueOnce(error).mockResolvedValueOnce(response);
      await expect(auth.refreshAuthSession()).rejects.toThrow(error.message);
      expect(storage.remove).not.toHaveBeenCalled();
      expect(auth.getMobileSession()?.refreshToken).toBe('refresh-1');
      await expect(auth.refreshAuthSession()).resolves.toBe(true);
      expect(refresh).toHaveBeenCalledTimes(2);
    }
  );

  it('treats server failures as recoverable and only clears a rejected refresh credential', async () => {
    const { auth, apiClient, SyncApiError, useAccountStore } = await setup();
    vi.spyOn(apiClient, 'refresh')
      .mockRejectedValueOnce(new SyncApiError(503, null))
      .mockRejectedValueOnce(new SyncApiError(401, null));
    await expect(auth.refreshAuthSession()).rejects.toThrow();
    expect(storage.remove).not.toHaveBeenCalled();
    await expect(auth.refreshAuthSession()).resolves.toBe(false);
    expect(storage.remove).toHaveBeenCalledOnce();
    expect(useAccountStore.getState()).toEqual({ session: null, status: 'reauth-required' });
  });

  it('does not turn an expired access token plus an offline refresh into invalid credentials', async () => {
    const { auth, apiClient } = await setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 401 }))
        .mockRejectedValueOnce(new TypeError('Offline'))
    );
    await expect(apiClient.pullChanges(0)).rejects.toThrow('Offline');
    expect(auth.getMobileSessionState()).toBe('authenticated');
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('preserves email in memory, secure storage, refresh and restart, without exposing credentials to UI', async () => {
    const { auth, apiClient, useAccountStore } = await setup();
    expect(auth.getMobileSession()?.email).toBe('me@example.com');
    expect(useAccountStore.getState().session).toEqual({
      userId: 'user-1',
      mode: 'registered',
      email: 'me@example.com',
    });
    vi.spyOn(apiClient, 'refresh').mockResolvedValue({ ...response, user: { id: 'user-1', mode: 'registered' } });
    await auth.refreshAuthSession();
    const stored = storage.set.mock.calls.at(-1)?.[1] as string;
    expect(JSON.parse(stored).email).toBe('me@example.com');
    vi.resetModules();
    storage.get.mockResolvedValue(stored);
    const restored = await import('../../../src/services/sync/authSession');
    await restored.initializeAuthSession();
    expect(restored.getMobileSession()?.email).toBe('me@example.com');
  });

  it('retries secure storage using the rotated secret without rotating the consumed secret again', async () => {
    const { auth, apiClient } = await setup();
    const refresh = vi.spyOn(apiClient, 'refresh').mockResolvedValue({ ...response, refreshToken: 'refresh-2' });
    storage.set.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(auth.refreshAuthSession()).rejects.toThrow('Storage unavailable');
    expect(storage.remove).not.toHaveBeenCalled();
    await expect(auth.refreshAuthSession()).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledOnce();
    expect(auth.getMobileSession()?.refreshToken).toBe('refresh-2');
  });

  it('coalesces refreshes and cannot replace a more recent sign-in with a stale refresh', async () => {
    const { auth, apiClient } = await setup();
    let resolve!: (value: typeof response) => void;
    const pending = new Promise<typeof response>(done => {
      resolve = done;
    });
    const refresh = vi.spyOn(apiClient, 'refresh').mockReturnValue(pending);
    const first = auth.refreshAuthSession();
    const second = auth.refreshAuthSession();
    await auth.persistMobileSession({ ...response, refreshToken: 'new-sign-in' });
    resolve({ ...response, refreshToken: 'stale-refresh' });
    await Promise.all([first, second]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(auth.getMobileSession()?.refreshToken).toBe('new-sign-in');
  });

  it('repairs a guest owner mode from a matching restored registered session', async () => {
    const { auth } = await setup();
    owner.get.mockResolvedValue({ userId: 'user-1', mode: 'guest' });
    await auth.initializeAuthSession();
    expect(owner.bind).toHaveBeenCalledWith({ userId: 'user-1', mode: 'registered' });
  });
  it('serializes secure writes so logout cannot leave a concurrently rotated credential behind', async () => {
    const { auth, apiClient } = await setup();
    let release!: () => void;
    storage.set.mockImplementationOnce(
      () =>
        new Promise<void>(done => {
          release = done;
        })
    );
    vi.spyOn(apiClient, 'refresh').mockResolvedValue({ ...response, refreshToken: 'rotated' });
    const rotating = auth.refreshAuthSession();
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(2));
    const clearing = auth.clearAuthSession();
    expect(storage.remove).not.toHaveBeenCalled();
    release();
    await Promise.all([rotating, clearing]);
    expect(auth.getMobileSession()).toBeNull();
    expect(storage.remove).toHaveBeenCalledOnce();
    expect(auth.getMobileSessionState()).toBe('reauth-required');
  });
  it('ignores a refresh result when a newer sign-in is waiting for secure storage', async () => {
    const { auth, apiClient } = await setup();
    let finishRefresh!: (value: typeof response) => void;
    let finishStorage!: () => void;
    vi.spyOn(apiClient, 'refresh').mockReturnValue(
      new Promise(done => {
        finishRefresh = done;
      })
    );
    const refreshing = auth.refreshAuthSession();
    storage.set.mockImplementationOnce(
      () =>
        new Promise<void>(done => {
          finishStorage = done;
        })
    );
    const signingIn = auth.persistMobileSession({ ...response, refreshToken: 'new-sign-in' });
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(2));
    finishRefresh({ ...response, refreshToken: 'stale-refresh' });
    await refreshing;
    finishStorage();
    await signingIn;
    expect(auth.getMobileSession()?.refreshToken).toBe('new-sign-in');
    expect(storage.set).toHaveBeenCalledTimes(2);
  });
});

it('a late refresh cannot publish credentials after the deletion fence is established', async () => {
  const { auth, apiClient } = await setup();
  let reply!: (value: typeof response) => void;
  const pending = new Promise<typeof response>(resolve => {
    reply = resolve;
  });
  vi.spyOn(apiClient, 'refresh').mockReturnValue(pending);
  const refreshing = auth.refreshAuthSession();
  await vi.waitFor(() => expect(apiClient.refresh).toHaveBeenCalledOnce());
  auth.pauseAccountSession('deletion-pending');
  reply({ ...response, refreshToken: 'obsolete-rotation' });
  expect(await refreshing).toBe(false);
  expect(auth.getMobileSessionState()).toBe('deletion-pending');
  expect(auth.getMobileSession()?.refreshToken).toBe('refresh-1');
  expect(storage.set).toHaveBeenCalledOnce();
});
