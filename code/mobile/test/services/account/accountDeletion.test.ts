import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database, closeDatabase, execute, readRows, resetDatabase } from '../../helpers/memorySqlite';
import type { SessionResponse } from '../../../src/domain/sync';
const mocks = vi.hoisted(() => ({
  secure: new Map<string, string>(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  deletion: vi.fn(),
  status: vi.fn(),
  refresh: vi.fn(),
  sync: vi.fn(),
  pull: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  upgrade: vi.fn(),
}));
vi.mock('../../../src/database/db', () => ({ db: database }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: mocks.get,
  setItemAsync: mocks.set,
  deleteItemAsync: mocks.remove,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytesAsync: async (length: number) => new Uint8Array((await import('node:crypto')).randomBytes(length)),
  digestStringAsync: async (_algorithm: string, value: string) =>
    (await import('node:crypto')).createHash('sha256').update(value).digest('hex'),
}));
vi.mock('../../../src/services/sync/apiClient', async importOriginal => {
  const original = await importOriginal<typeof import('../../../src/services/sync/apiClient')>();
  return {
    ...original,
    apiClient: {
      ...original.apiClient,
      isConfigured: true,
      deleteAccount: mocks.deletion,
      deletionStatus: mocks.status,
      refresh: mocks.refresh,
      sync: mocks.sync,
      pullChanges: mocks.pull,
      register: mocks.register,
      login: mocks.login,
      upgrade: mocks.upgrade,
    },
  };
});
const session: SessionResponse = {
  user: { id: 'owner-A', mode: 'registered', email: 'me@example.com' },
  accessToken: 'access-A',
  refreshToken: 'refresh-A',
  accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
};
const receipt = { status: 'completed', deletedUserId: 'owner-A', completedAt: '2026-10-12T12:00:00.000Z' };
let service: typeof import('../../../src/services/account/accountDeletion');
let auth: typeof import('../../../src/services/sync/authSession');
let owners: typeof import('../../../src/database/syncStateRepository');
let repository: typeof import('../../../src/database/accountDeletionRepository');

beforeEach(async () => {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://drivecost.test');
  resetDatabase();
  vi.resetModules();
  vi.resetAllMocks();
  mocks.secure.clear();
  mocks.get.mockImplementation(async key => mocks.secure.get(key) ?? null);
  mocks.set.mockImplementation(async (key, value) => {
    mocks.secure.set(key, value);
  });
  mocks.remove.mockImplementation(async key => {
    mocks.secure.delete(key);
  });
  mocks.deletion.mockResolvedValue(receipt);
  mocks.status.mockResolvedValue(receipt);
  mocks.refresh.mockResolvedValue(session);
  mocks.sync.mockResolvedValue(undefined);
  mocks.pull.mockImplementation(async after => ({ data: [], nextCursor: after }));
  service = await import('../../../src/services/account/accountDeletion');
  auth = await import('../../../src/services/sync/authSession');
  owners = await import('../../../src/database/syncStateRepository');
  repository = await import('../../../src/database/accountDeletionRepository');
  await owners.bindSyncOwner({ userId: 'owner-A', mode: 'registered' });
  await auth.persistMobileSession(session);
});
afterEach(() => {
  closeDatabase();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const secretKey = 'drivecost.account-deletion.v1';
function snapshot() {
  return [
    'vehicles',
    'fuel_entries',
    'charging_entries',
    'maintenance_entries',
    'ownership_expenses',
    'recurring_expenses',
    'sync_queue',
    'account_adoption_queue',
  ].map(table => readRows(`SELECT * FROM ${table} ORDER BY rowid`));
}
function entries() {
  execute(`INSERT INTO fuel_entries VALUES (1,'fuel-1',1,'2026-10-11',40,60,1000,'full');
    INSERT INTO charging_entries VALUES (1,'charge-1',1,'2026-10-11',20,10,1000);
    INSERT INTO maintenance_entries VALUES (1,'service-1',1,'Service','',100,'2026-10-11',1000);
    INSERT INTO ownership_expenses VALUES (1,'expense-1',1,'insurance',500,'','2026-10-11',1000);
    INSERT INTO recurring_expenses VALUES (1,'schedule-1',1,'insurance',500,12,'2026-10-11',NULL,'',1);
    INSERT INTO sync_queue (entityType,operation,payload,createdAt,retryCount) VALUES ('vehicle','upsert','{}','2026-10-12',0);
    INSERT INTO account_adoption_queue VALUES ('owner-A','vehicle','vehicle-1','{}',1);
    INSERT INTO sync_state VALUES ('pull_cursor:owner-A','12'), ('preference:theme','navy');`);
}
async function unknown() {
  mocks.deletion.mockRejectedValueOnce(new Error('Lost response'));
  expect(await service.deleteAccount('correct-password')).toEqual({ tag: 'unknown' });
}
function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('account deletion lifecycle', () => {
  it('saves a secure 32-byte operation secret before HTTP, then clears all business/sync data and credentials', async () => {
    entries();
    const vehicles = (await import('../../../src/store/vehicleStore')).useVehicleStore;
    await vehicles.getState().loadVehicles();
    mocks.secure.set('drivecost.access-token', 'retired-token');
    mocks.deletion.mockImplementation(async input => {
      const stored = JSON.parse(mocks.secure.get(secretKey)!);
      expect(stored.operationSecret).toBe(input.operationSecret);
      expect(Buffer.from(input.operationSecret, 'base64url')).toHaveLength(32);
      expect(input).toEqual({ operationSecret: stored.operationSecret, password: 'correct-password' });
      const intent = await repository.readDeletionIntent();
      expect(intent?.phase).toBe('unknown');
      expect(JSON.stringify(readRows('SELECT * FROM sync_state'))).not.toContain(input.operationSecret);
      expect(await owners.isSessionBlocked()).toBe(true);
      return receipt;
    });
    expect(await service.deleteAccount('correct-password')).toEqual({ tag: 'complete' });
    expect(snapshot().every(rows => rows.length === 0)).toBe(true);
    expect(await owners.getSyncOwner()).toBeNull();
    expect(await owners.getPullCursor('owner-A')).toBe(0);
    expect(readRows('SELECT * FROM sync_state')).toEqual([
      { key: 'preference:theme', value: 'navy' },
      { key: 'session_blocked', value: '0' },
    ]);
    expect(vehicles.getState().vehicles).toEqual([]);
    expect(vehicles.getState().activeVehicleId).toBeNull();
    expect(auth.getMobileSession()).toBeNull();
    expect(auth.getMobileSessionState()).toBe('local-only');
    expect(mocks.secure.size).toBe(0);
    const saved = await vehicles.getState().createVehicle({
      brand: 'Honda',
      model: 'Civic',
      year: 2024,
      ownershipStartMileage: 0,
      trackingStartMileage: 0,
      currentOdometer: 0,
    });
    expect(saved.id).toBeGreaterThan(0);
    expect(await owners.getSyncOwner()).toBeNull();
  });
  it('opening and cancelling makes no destructive request', async () => {
    const before = snapshot();
    expect(await service.openAccountDeletion()).toMatchObject({
      tag: 'ready',
      mode: 'registered',
      email: 'me@example.com',
    });
    expect(snapshot()).toEqual(before);
    expect(mocks.deletion).not.toHaveBeenCalled();
    expect(mocks.secure.has(secretKey)).toBe(false);
  });
  it('requires a password and rejects mismatched or absent authentication before storing a secret', async () => {
    await expect(service.deleteAccount('')).rejects.toThrow('current password');
    await auth.persistMobileSession({ ...session, user: { id: 'other', mode: 'registered' } });
    await expect(service.deleteAccount('correct-password')).rejects.toThrow('Sign in');
    expect(mocks.deletion).not.toHaveBeenCalled();
    expect(mocks.secure.has(secretKey)).toBe(false);
  });
  it('restores correction after an explicit wrong-password rejection, preserving local records and credentials', async () => {
    const { SyncApiError } = await import('../../../src/services/sync/apiClient');
    const before = snapshot();
    mocks.deletion.mockRejectedValueOnce(
      new SyncApiError(403, {
        status: 403,
        type: 'https://drivecost.app/problems/deletion-confirmation-failed',
        title: 'Rejected',
      })
    );
    await expect(service.deleteAccount('wrong-password')).rejects.toThrow('did not match');
    expect(snapshot()).toEqual(before);
    expect(await repository.readDeletionIntent()).toBeNull();
    expect(auth.getMobileSessionState()).toBe('authenticated');
    expect(mocks.secure.has(secretKey)).toBe(false);
    expect(await service.deleteAccount('correct-password')).toEqual({ tag: 'complete' });
  });
  it('coalesces duplicate submission into one secret and one deletion request', async () => {
    const response = deferred<typeof receipt>();
    mocks.deletion.mockReturnValue(response.promise);
    const first = service.deleteAccount('correct-password');
    const second = service.deleteAccount('correct-password');
    await vi.waitFor(() => expect(mocks.deletion).toHaveBeenCalledOnce());
    response.resolve(receipt);
    expect(await first).toEqual({ tag: 'complete' });
    expect(await second).toEqual({ tag: 'complete' });
    expect(mocks.set.mock.calls.filter(([key]) => key === secretKey)).toHaveLength(1);
  });
  it('uses the live guest refresh credential without a password or a replacement guest', async () => {
    await owners.bindSyncOwner({ userId: 'owner-A', mode: 'guest' });
    await auth.persistMobileSession({ ...session, user: { id: 'owner-A', mode: 'guest' } });
    expect(await service.openAccountDeletion()).toMatchObject({ tag: 'ready', mode: 'guest' });
    expect(await service.deleteAccount('')).toEqual({ tag: 'complete' });
    expect(mocks.deletion.mock.calls[0][0]).toMatchObject({ refreshToken: 'refresh-A' });
    expect(mocks.deletion.mock.calls[0][0]).not.toHaveProperty('password');
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('blocks a legacy guest missing its credential and preserves ownership', async () => {
    await owners.bindSyncOwner({ userId: 'owner-A', mode: 'guest' });
    await auth.clearSignedOutSession();
    expect(await service.openAccountDeletion()).toMatchObject({ tag: 'blocked' });
    await expect(service.deleteAccount('')).rejects.toThrow('original sign-in credential');
    expect((await owners.getSyncOwner())?.userId).toBe('owner-A');
    expect(mocks.deletion).not.toHaveBeenCalled();
  });
  it('never sends deletion if secure persistence fails or cannot be verified', async () => {
    mocks.set.mockRejectedValueOnce(new Error('SecureStore unavailable'));
    await expect(service.deleteAccount('correct-password')).rejects.toThrow();
    expect(mocks.deletion).not.toHaveBeenCalled();
    mocks.set.mockImplementationOnce(async () => undefined);
    await expect(service.deleteAccount('correct-password')).rejects.toThrow('prepared safely');
    expect(mocks.deletion).not.toHaveBeenCalled();
    expect(await repository.readDeletionIntent()).toBeNull();
  });
  it.each([401, 410, 429, 500, 503])(
    'never treats HTTP %s as completion and retains the same recovery identity',
    async status => {
      const { SyncApiError } = await import('../../../src/services/sync/apiClient');
      const before = snapshot();
      mocks.deletion.mockRejectedValueOnce(new SyncApiError(status, null));
      expect(await service.deleteAccount('correct-password')).toEqual({ tag: 'unknown' });
      expect(snapshot()).toEqual(before);
      expect((await owners.getSyncOwner())?.userId).toBe('owner-A');
      expect(auth.getMobileSessionState()).toBe('deletion-pending');
      expect(mocks.secure.has(secretKey)).toBe(true);
      const operationSecret = JSON.parse(mocks.secure.get(secretKey)!).operationSecret;
      mocks.status.mockResolvedValueOnce({ status: 'unknown' });
      expect(await service.checkAccountDeletion()).toEqual({ tag: 'unknown' });
      expect(mocks.status).toHaveBeenCalledWith(operationSecret);
      expect(snapshot()).toEqual(before);
      expect(mocks.deletion).toHaveBeenCalledOnce();
    }
  );
  it('recovers a lost response on restart without refreshing credentials or sending another deletion', async () => {
    await unknown();
    const secret = mocks.secure.get(secretKey);
    vi.resetModules();
    service = await import('../../../src/services/account/accountDeletion');
    auth = await import('../../../src/services/sync/authSession');
    expect(await service.restoreAccountDeletion()).toEqual({ tag: 'unknown' });
    await auth.initializeAuthSession();
    expect(mocks.secure.get(secretKey)).toBe(secret);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.deletion).toHaveBeenCalledOnce();
    expect(await service.checkAccountDeletion()).toEqual({ tag: 'complete' });
    expect(snapshot().every(rows => rows.length === 0)).toBe(true);
  });
  it('preserves data on status outages, missing receipts, and a receipt for a different owner', async () => {
    await unknown();
    const before = snapshot();
    mocks.status
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ status: 'unknown' })
      .mockResolvedValueOnce({ ...receipt, deletedUserId: 'different' });
    for (let index = 0; index < 3; index++) expect(await service.checkAccountDeletion()).toEqual({ tag: 'unknown' });
    expect(snapshot()).toEqual(before);
    expect(await owners.isSessionBlocked()).toBe(true);
    expect(await service.checkAccountDeletion()).toEqual({ tag: 'complete' });
  });
  it('allows offline recording while unknown, but needs renewed confirmation of all changed rows', async () => {
    await unknown();
    const vehicles = (await import('../../../src/store/vehicleStore')).useVehicleStore;
    await vehicles.getState().createVehicle({
      brand: 'New',
      model: 'Car',
      year: 2024,
      ownershipStartMileage: 0,
      trackingStartMileage: 0,
      currentOdometer: 0,
    });
    const view = await service.checkAccountDeletion();
    expect(view.tag).toBe('needs-confirmation');
    expect(readRows('SELECT * FROM vehicles')).toHaveLength(2);
    expect(mocks.sync).not.toHaveBeenCalled();
    if (view.tag !== 'needs-confirmation') throw new Error('Expected confirmation');
    execute("UPDATE vehicles SET model='Changed again' WHERE id=1");
    const newer = await service.confirmDeviceCleanup(view.signature);
    expect(newer.tag).toBe('needs-confirmation');
    if (newer.tag !== 'needs-confirmation') throw new Error('Expected renewed confirmation');
    expect(await service.confirmDeviceCleanup(newer.signature)).toEqual({ tag: 'complete' });
  });
  it('detects a field change without relying on counts or active selection', async () => {
    entries();
    await unknown();
    execute('UPDATE ownership_expenses SET totalPaid=999 WHERE id=1');
    expect((await service.checkAccountDeletion()).tag).toBe('needs-confirmation');
    expect(readRows('SELECT * FROM ownership_expenses')).toHaveLength(1);
  });
  it('rolls back SQLite cleanup with its owner/cursor/jobs and supports retry', async () => {
    entries();
    const before = snapshot();
    execute("CREATE TRIGGER block_delete BEFORE DELETE ON charging_entries BEGIN SELECT RAISE(ABORT,'injected'); END;");
    expect((await service.deleteAccount('correct-password')).tag).toBe('cleanup-pending');
    expect(snapshot()).toEqual(before);
    expect((await owners.getSyncOwner())?.userId).toBe('owner-A');
    expect(await owners.getPullCursor('owner-A')).toBe(12);
    expect((await repository.readDeletionIntent())?.phase).toBe('cleanup');
    expect(mocks.secure.has(secretKey)).toBe(true);
    execute('DROP TRIGGER block_delete');
    expect(await service.checkAccountDeletion()).toEqual({ tag: 'complete' });
  });
  it.each(['drivecost.auth-session.v2', 'drivecost.access-token', secretKey])(
    'recovers secure cleanup failure for %s without restoring the old session',
    async keyToFail => {
      mocks.secure.set('drivecost.access-token', 'retired');
      mocks.remove.mockImplementation(async key => {
        if (key === keyToFail) throw new Error('Secure storage busy');
        mocks.secure.delete(key);
      });
      expect((await service.deleteAccount('correct-password')).tag).toBe('cleanup-pending');
      expect(snapshot().every(rows => rows.length === 0)).toBe(true);
      expect(await owners.getSyncOwner()).toBeNull();
      expect((await repository.readDeletionIntent())?.phase).toBe('cleared');
      expect(await owners.isSessionBlocked()).toBe(true);
      vi.resetModules();
      service = await import('../../../src/services/account/accountDeletion');
      auth = await import('../../../src/services/sync/authSession');
      await auth.initializeAuthSession();
      expect(auth.getMobileSession()).toBeNull();
      expect(mocks.refresh).not.toHaveBeenCalled();
      mocks.remove.mockImplementation(async key => {
        mocks.secure.delete(key);
      });
      expect(await service.restoreAccountDeletion()).toEqual({ tag: 'complete' });
      expect(mocks.secure.size).toBe(0);
    }
  );
  it('keeps confirmed cleanup durable if the final lifecycle-marker removal fails', async () => {
    execute(
      "CREATE TRIGGER block_finish BEFORE DELETE ON sync_state WHEN OLD.key='account_deletion' BEGIN SELECT RAISE(ABORT,'injected'); END;"
    );
    expect((await service.deleteAccount('correct-password')).tag).toBe('cleanup-pending');
    expect((await repository.readDeletionIntent())?.phase).toBe('cleared');
    expect(mocks.secure.size).toBe(0);
    execute('DROP TRIGGER block_finish');
    vi.resetModules();
    service = await import('../../../src/services/account/accountDeletion');
    expect(await service.restoreAccountDeletion()).toEqual({ tag: 'complete' });
  });
  it('blocks sign-in, creation, ownership rebinding and sign-out while recovery is unresolved', async () => {
    await unknown();
    const { signIn, signOut } = await import('../../../src/services/account/accountAccess');
    const { createAccount } = await import('../../../src/services/account/accountService');
    for (const operation of [
      () => signIn('other@example.com', 'password'),
      () => createAccount('new@example.com', 'password'),
      () => signOut(),
      () => owners.bindSyncOwner({ userId: 'other', mode: 'registered' }),
      () => auth.persistMobileSession({ ...session, user: { id: 'other', mode: 'registered' } }),
    ])
      await expect(operation()).rejects.toThrow();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect((await owners.getSyncOwner())?.userId).toBe('owner-A');
  });
  it('settles the current refresh before deletion and cannot overwrite reset stores with old loads', async () => {
    const refresh = deferred<SessionResponse>();
    mocks.refresh.mockReturnValue(refresh.promise);
    const refreshing = auth.refreshAuthSession();
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    const vehicleRepository = await import('../../../src/database/vehicleRepository');
    const old = await vehicleRepository.getVehicles();
    const pending = deferred<typeof old>();
    const read = vi.spyOn(vehicleRepository, 'getVehicles').mockReturnValueOnce(pending.promise);
    const vehicles = (await import('../../../src/store/vehicleStore')).useVehicleStore;
    const loading = vehicles.getState().loadVehicles();
    const deleting = service.deleteAccount('correct-password');
    refresh.resolve({ ...session, refreshToken: 'settled-rotation' });
    expect(await deleting).toEqual({ tag: 'complete' });
    pending.resolve(old);
    await Promise.all([refreshing, loading]);
    expect(auth.getMobileSession()).toBeNull();
    expect(mocks.secure.size).toBe(0);
    expect(vehicles.getState().vehicles).toEqual([]);
    read.mockRestore();
  });
  it('aborts an old local transaction queued across final cleanup so it cannot repopulate the fresh dataset', async () => {
    await unknown();
    execute("UPDATE vehicles SET model='Additional record change' WHERE id=1");
    const review = await service.checkAccountDeletion();
    if (review.tag !== 'needs-confirmation') throw new Error('Expected renewed confirmation');
    const entered = deferred<void>();
    const release = deferred<void>();
    const { persistAndQueueSyncBatch } = await import('../../../src/services/sync/offlineSync');
    const writing = persistAndQueueSyncBatch(async transaction => {
      entered.resolve();
      await release.promise;
      await transaction.runAsync("UPDATE vehicles SET model='Obsolete write' WHERE id=1");
    });
    const rejected = expect(writing).rejects.toThrow('being reset');
    await entered.promise;
    const context = await import('../../../src/services/app/datasetContext');
    const generation = context.getDatasetGeneration();
    const cleaning = service.confirmDeviceCleanup(review.signature);
    await vi.waitFor(() => expect(() => context.assertDatasetCurrent(generation)).toThrow('being reset'));
    release.resolve();
    await rejected;
    expect(await cleaning).toEqual({ tag: 'complete' });
    expect(readRows('SELECT * FROM vehicles')).toEqual([]);
  });
  it('requires renewed confirmation for records changed while secure intent preparation is waiting', async () => {
    const saving = deferred<void>();
    mocks.set.mockImplementationOnce(async (key, value) => {
      await saving.promise;
      mocks.secure.set(key, value);
    });
    const deleting = service.deleteAccount('correct-password');
    await vi.waitFor(() => expect(mocks.set.mock.calls.some(([key]) => key === secretKey)).toBe(true));
    execute("UPDATE vehicles SET brand='Changed during preparation' WHERE id=1");
    saving.resolve();
    expect((await deleting).tag).toBe('needs-confirmation');
    expect(readRows('SELECT * FROM vehicles')).toHaveLength(1);
  });
  it.each(['push', 'pull', 'adoption'])(
    'late %s delivery cannot acknowledge jobs or restore records after cleanup',
    async kind => {
      const sync = await import('../../../src/services/sync/syncService');
      const api = (await import('../../../src/services/sync/apiClient')).apiClient;
      const flight = deferred<unknown>();
      const payload = {
        clientId: 'vehicle-1',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2022,
        ownershipStartMileage: 1000,
        trackingStartMileage: 1000,
        currentOdometer: 1000,
      };
      if (kind === 'push') {
        await database.runAsync(
          "INSERT INTO sync_queue (entityType,operation,payload,createdAt,retryCount) VALUES ('vehicle','upsert',?,'2026-10-12',0)",
          JSON.stringify(payload)
        );
        mocks.sync.mockReturnValueOnce(flight.promise);
      } else if (kind === 'pull') mocks.pull.mockReturnValueOnce(flight.promise);
      else {
        await database.runAsync(
          "INSERT INTO account_adoption_queue VALUES ('owner-A','vehicle','vehicle-1',?,0)",
          JSON.stringify(payload)
        );
        vi.spyOn(api, 'createAdoptedEntity').mockReturnValueOnce(flight.promise as Promise<void>);
      }
      const syncing = sync.processSyncQueue();
      if (kind === 'push') await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledOnce());
      else if (kind === 'pull') await vi.waitFor(() => expect(mocks.pull).toHaveBeenCalledOnce());
      else await vi.waitFor(() => expect(api.createAdoptedEntity).toHaveBeenCalledOnce());
      expect(await service.deleteAccount('correct-password')).toEqual({ tag: 'complete' });
      flight.resolve(
        kind === 'pull'
          ? { data: [{ sequence: 1, entityType: 'vehicle', operation: 'upsert', payload }], nextCursor: 1 }
          : undefined
      );
      await syncing.catch(() => undefined);
      expect(snapshot().every(rows => rows.length === 0)).toBe(true);
      expect(await owners.getSyncOwner()).toBeNull();
      const status = (await import('../../../src/store/syncStore')).useSyncStore.getState();
      expect(status.phase).toBe('local-only');
    }
  );
  it('cannot activate a guest upgrade response from before the dataset was deleted', async () => {
    await owners.bindSyncOwner({ userId: 'owner-A', mode: 'guest' });
    await auth.persistMobileSession({ ...session, user: { id: 'owner-A', mode: 'guest' } });
    const reply = deferred<SessionResponse>();
    mocks.upgrade.mockReturnValue(reply.promise);
    const { createAccount } = await import('../../../src/services/account/accountService');
    const upgrading = createAccount('me@example.com', 'correct-password');
    const rejected = expect(upgrading).rejects.toThrow('reset');
    await vi.waitFor(() => expect(mocks.upgrade).toHaveBeenCalledOnce());
    expect(await service.deleteAccount('')).toEqual({ tag: 'complete' });
    reply.resolve(session);
    await rejected;
    expect(await owners.getSyncOwner()).toBeNull();
    expect(auth.getMobileSession()).toBeNull();
  });
  it('fences a secondary device only for the explicit backend account-unavailable response', async () => {
    const before = snapshot();
    const api = (await import('../../../src/services/sync/apiClient')).apiClient;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 410,
            type: 'https://drivecost.app/problems/account-unavailable',
            title: 'Unavailable',
          }),
          { status: 410 }
        )
      )
    );
    await expect(api.pullAccountChanges(0, 'access-A')).rejects.toThrow();
    expect(auth.getMobileSessionState()).toBe('account-unavailable');
    expect(await owners.getAccountLifecycleBlock()).toBe('account-unavailable');
    expect(snapshot()).toEqual(before);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('never republishes entry snapshots loaded before the dataset reset', async () => {
    entries();
    const source = await import('../../../src/database/fuelRepository');
    const old = await source.getFuelEntries(1);
    const reply = deferred<typeof old>();
    vi.spyOn(source, 'getFuelEntries').mockReturnValueOnce(reply.promise);
    const store = (await import('../../../src/store/fuelStore')).useFuelStore;
    const loading = store.getState().loadFuelEntries(1);
    expect(await service.deleteAccount('correct-password')).toEqual({ tag: 'complete' });
    reply.resolve(old);
    await loading;
    expect(store.getState().fuelEntries).toEqual([]);
    expect(store.getState().loadStates).toEqual({});
  });
  it('rolls back acknowledgement if the account fence changes inside its transaction', async () => {
    const payload = {
      clientId: 'vehicle-1',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
      ownershipStartMileage: 1000,
      trackingStartMileage: 1000,
      currentOdometer: 1000,
    };
    await database.runAsync(
      "INSERT INTO sync_queue (entityType,operation,payload,createdAt,retryCount) VALUES ('vehicle','upsert',?,'2026-10-12',0)",
      JSON.stringify(payload)
    );
    const jobs = await import('../../../src/database/syncRepository');
    const original = jobs.deleteSyncJob;
    vi.spyOn(jobs, 'deleteSyncJob').mockImplementation(async (id, transaction) => {
      await original(id, transaction);
      auth.pauseAccountSession('deletion-pending');
    });
    await (await import('../../../src/services/sync/syncService')).processSyncQueue();
    expect(readRows('SELECT * FROM sync_queue')).toHaveLength(1);
    expect(mocks.pull).not.toHaveBeenCalled();
  });
  it('waits for a guest rotation and uses its current refresh proof', async () => {
    await owners.bindSyncOwner({ userId: 'owner-A', mode: 'guest' });
    const guest = { ...session, user: { id: 'owner-A', mode: 'guest' as const } };
    await auth.persistMobileSession(guest);
    const response = deferred<SessionResponse>();
    mocks.refresh.mockReturnValue(response.promise);
    const rotating = auth.refreshAuthSession();
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    const deleting = service.deleteAccount('');
    response.resolve({ ...guest, refreshToken: 'current-guest-proof' });
    await rotating;
    expect(await deleting).toEqual({ tag: 'complete' });
    expect(mocks.deletion.mock.calls[0][0]).toMatchObject({ refreshToken: 'current-guest-proof' });
  });
  it('preserves recoverable credentials and sends no deletion when an active refresh fails temporarily', async () => {
    const response = deferred<SessionResponse>();
    mocks.refresh.mockReturnValue(response.promise);
    const rotating = auth.refreshAuthSession();
    const rotationFailure = expect(rotating).rejects.toThrow('Offline');
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    const deleting = service.deleteAccount('correct-password');
    const deletionFailure = expect(deleting).rejects.toThrow('Offline');
    const context = await import('../../../src/services/app/datasetContext');
    await vi.waitFor(() => expect(context.isAccountContextBlocked()).toBe(true));
    expect(mocks.secure.has(secretKey)).toBe(false);
    response.reject(new Error('Offline'));
    await rotationFailure;
    await deletionFailure;
    expect(auth.getMobileSession()?.refreshToken).toBe('refresh-A');
    expect(mocks.deletion).not.toHaveBeenCalled();
    expect(mocks.secure.has(secretKey)).toBe(false);
    expect(await repository.readDeletionIntent()).toBeNull();
  });
  it('keeps a secondary account-unavailable marker terminal across restart and preserves every local row', async () => {
    entries();
    const before = snapshot();
    await owners.markAccountUnavailable('owner-A');
    vi.resetModules();
    service = await import('../../../src/services/account/accountDeletion');
    auth = await import('../../../src/services/sync/authSession');
    expect((await service.restoreAccountDeletion()).tag).toBe('blocked');
    await auth.initializeAuthSession();
    expect(auth.getMobileSessionState()).toBe('account-unavailable');
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
    await expect(service.deleteAccount('correct-password')).rejects.toThrow();
    expect(mocks.deletion).not.toHaveBeenCalled();
  });
});
