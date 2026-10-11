import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database, closeDatabase, execute, readRows, resetDatabase } from '../../helpers/memorySqlite';
import type { PullResponse, SessionResponse } from '../../../src/domain/sync';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  pullAccount: vi.fn(),
  createAdopted: vi.fn(),
  sync: vi.fn(),
  pull: vi.fn(),
  refresh: vi.fn(),
  secure: new Map<string, string>(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../../src/database/db', () => ({ db: database }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: mocks.get,
  setItemAsync: mocks.set,
  deleteItemAsync: mocks.remove,
}));
vi.mock('../../../src/services/sync/apiClient', async importOriginal => {
  const original = await importOriginal<typeof import('../../../src/services/sync/apiClient')>();
  return {
    ...original,
    apiClient: {
      ...original.apiClient,
      isConfigured: true,
      login: mocks.login,
      logout: mocks.logout,
      pullAccountChanges: mocks.pullAccount,
      createAdoptedEntity: mocks.createAdopted,
      sync: mocks.sync,
      pullChanges: mocks.pull,
      refresh: mocks.refresh,
    },
  };
});

const account: SessionResponse = {
  user: { id: 'account-A', mode: 'registered', email: 'me@example.com' },
  accessToken: 'access-A',
  refreshToken: 'refresh-A',
  accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
};
const remoteVehicle = {
  clientId: 'cloud-vehicle',
  brand: 'Renault',
  model: 'Clio',
  year: 2024,
  ownershipStartMileage: 2_000,
  trackingStartMileage: 2_000,
  currentOdometer: 3_000,
};
const feed: PullResponse = {
  data: [{ sequence: 1, entityType: 'vehicle', operation: 'upsert', payload: remoteVehicle }],
  nextCursor: 1,
};
let access: typeof import('../../../src/services/account/accountAccess');
let auth: typeof import('../../../src/services/sync/authSession');
let owner: typeof import('../../../src/database/syncStateRepository');

beforeEach(async () => {
  resetDatabase();
  vi.resetModules();
  vi.resetAllMocks();
  mocks.secure.clear();
  mocks.login.mockResolvedValue(account);
  mocks.logout.mockResolvedValue(undefined);
  mocks.pullAccount.mockImplementation(async (after: number) => (after === 0 ? feed : { data: [], nextCursor: after }));
  mocks.createAdopted.mockResolvedValue(undefined);
  mocks.sync.mockResolvedValue(undefined);
  mocks.pull.mockImplementation(async (after: number) => ({ data: [], nextCursor: after }));
  mocks.get.mockImplementation(async (key: string) => mocks.secure.get(key) ?? null);
  mocks.set.mockImplementation(async (key: string, value: string) => {
    mocks.secure.set(key, value);
  });
  mocks.remove.mockImplementation(async (key: string) => {
    mocks.secure.delete(key);
  });
  access = await import('../../../src/services/account/accountAccess');
  auth = await import('../../../src/services/sync/authSession');
  owner = await import('../../../src/database/syncStateRepository');
});
afterEach(closeDatabase);

function rows() {
  return [
    'vehicles',
    'fuel_entries',
    'charging_entries',
    'maintenance_entries',
    'ownership_expenses',
    'recurring_expenses',
    'sync_queue',
    'sync_state',
    'account_adoption_queue',
  ].map(table => readRows(`SELECT * FROM ${table} ORDER BY rowid`));
}
async function choice() {
  const result = await access.signIn('me@example.com', 'password');
  if (result.tag !== 'choose-data') throw new Error('Expected explicit data choice');
  return result.attemptId;
}
async function pendingVehicle(label = 'Earlier edit') {
  const { readAccountDataset } = await import('../../../src/database/accountDataRepository');
  const vehicle = (await readAccountDataset()).entities.find(entity => entity.entityType === 'vehicle');
  if (!vehicle) throw new Error('Missing local vehicle');
  await database.runAsync(
    `INSERT INTO sync_queue (entityType, operation, payload, createdAt, retryCount) VALUES ('vehicle', 'upsert', ?, ?, 0)`,
    JSON.stringify({ ...vehicle.payload, label }),
    '2026-10-11T12:00:00.000Z'
  );
}
function seedEntries() {
  execute(`INSERT INTO fuel_entries VALUES (1, 'fuel-1', 1, '2026-10-11T00:00:00.000Z', 40, 60, 1000, 'full');
    INSERT INTO charging_entries VALUES (1, 'charge-1', 1, '2026-10-11T00:00:00.000Z', 20, 10, 1000);
    INSERT INTO maintenance_entries VALUES (1, 'service-1', 1, 'Service', '', 100, '2026-10-11T00:00:00.000Z', 1000);
    INSERT INTO ownership_expenses VALUES (1, 'expense-1', 1, 'insurance', 500, '', '2026-10-11T00:00:00.000Z', 1000);
    INSERT INTO recurring_expenses VALUES (1, 'recurring-1', 1, 'insurance', 500, 12, '2026-10-11T00:00:00.000Z', NULL, '', 1);`);
}

describe('existing account sign-in', () => {
  it('downloads and binds an empty installation without asking for a data choice', async () => {
    execute('DELETE FROM vehicles');
    expect(await access.signIn(' me@example.com ', 'password')).toEqual({ tag: 'signed-in' });
    expect(mocks.login).toHaveBeenCalledWith('me@example.com', 'password');
    expect(await owner.getSyncOwner()).toEqual({ userId: 'account-A', mode: 'registered' });
    expect(await owner.getPullCursor('account-A')).toBe(1);
    expect(readRows<{ clientId: string }>('SELECT clientId FROM vehicles')).toEqual([{ clientId: 'cloud-vehicle' }]);
    expect(auth.getMobileSession()?.userId).toBe('account-A');
  });
  it('isolates the login until a non-empty unbound installation explicitly chooses', async () => {
    await pendingVehicle();
    const original = rows();
    await choice();
    expect(rows()).toEqual(original);
    expect(mocks.pullAccount).not.toHaveBeenCalled();
    expect(mocks.createAdopted).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(auth.getMobileSession()).toBeNull();
  });
  it.each(['registered', 'guest'] as const)(
    'rejects another account over a %s owner without changing any local data',
    async mode => {
      await owner.bindSyncOwner({ userId: 'account-B', mode });
      await pendingVehicle();
      const original = rows();
      await expect(access.signIn('me@example.com', 'password')).rejects.toThrow('linked to another account');
      expect(rows()).toEqual(original);
      expect(mocks.set).not.toHaveBeenCalled();
      expect(mocks.logout).toHaveBeenCalledWith('refresh-A');
    }
  );
  it('rejects a login that finishes after the user has left sign-in', async () => {
    let resolve!: (response: SessionResponse) => void;
    mocks.login.mockReturnValue(
      new Promise<SessionResponse>(done => {
        resolve = done;
      })
    );
    const controller = new AbortController();
    const signingIn = access.signIn('me@example.com', 'password', controller.signal);
    const cancelled = expect(signingIn).rejects.toThrow('cancelled');
    controller.abort();
    resolve(account);
    await cancelled;
    expect(await owner.getSyncOwner()).toBeNull();
    expect(mocks.secure.size).toBe(0);
    expect(mocks.logout).toHaveBeenCalledWith('refresh-A');
  });
});

describe('explicit local data choice', () => {
  it('preserves all local rows, IDs, legitimate pending jobs and the active vehicle while adding remote data', async () => {
    seedEntries();
    await pendingVehicle();
    const { useVehicleStore } = await import('../../../src/store/vehicleStore');
    await useVehicleStore.getState().loadVehicles();
    const oldJobs = readRows('SELECT * FROM sync_queue');
    const id = await choice();
    await access.confirmAccountDataChoice(id, { kind: 'add' });
    expect(await owner.getSyncOwner()).toEqual({ userId: 'account-A', mode: 'registered' });
    expect(useVehicleStore.getState().activeVehicleId).toBe(1);
    expect(readRows('SELECT * FROM vehicles')).toHaveLength(2);
    for (const table of [
      'fuel_entries',
      'charging_entries',
      'maintenance_entries',
      'ownership_expenses',
      'recurring_expenses',
    ]) {
      expect(readRows<{ id: number; vehicleId: number }>(`SELECT * FROM ${table}`)[0]).toMatchObject({
        id: 1,
        vehicleId: 1,
      });
    }
    expect(readRows('SELECT * FROM sync_queue')).toEqual(oldJobs);
    expect(readRows('SELECT * FROM account_adoption_queue')).toHaveLength(6);
    expect(await owner.getPullCursor('account-A')).toBe(1);
    const { pushAdoptedData } = await import('../../../src/services/account/pushAdoptedData');
    expect(await pushAdoptedData('account-A')).toBe(true);
    expect(mocks.createAdopted.mock.calls[0][0]).toBe('vehicle');
    expect(mocks.createAdopted).toHaveBeenCalledTimes(6);
    expect(readRows('SELECT * FROM sync_queue')).toEqual([]);
  });
  it.each(['upsert', 'delete'] as const)(
    'rejects a colliding cloud %s, including tombstones, before binding or uploading',
    async operation => {
      mocks.pullAccount.mockImplementation(async (after: number) =>
        after === 0
          ? {
              data: [
                {
                  sequence: 1,
                  entityType: 'vehicle',
                  operation,
                  payload:
                    operation === 'delete' ? { clientId: 'vehicle-1' } : { ...remoteVehicle, clientId: 'vehicle-1' },
                },
              ],
              nextCursor: 1,
            }
          : { data: [], nextCursor: after }
      );
      const original = rows();
      const id = await choice();
      await expect(access.confirmAccountDataChoice(id, { kind: 'add' })).rejects.toThrow('cannot be combined safely');
      expect(rows()).toEqual(original);
      expect(mocks.createAdopted).not.toHaveBeenCalled();
      expect(mocks.set).not.toHaveBeenCalled();
    }
  );
  it.each([
    ['delete', '{"clientId":"remote-record"}'],
    ['upsert', '{bad-json'],
    [
      'upsert',
      '{"clientId":"missing-local-row","brand":"Toyota","model":"Corolla","year":2022,"ownershipStartMileage":0,"trackingStartMileage":0,"currentOdometer":0}',
    ],
  ])('rejects unsafe pending %s operations without dropping them', async (operation, payload) => {
    await database.runAsync(
      `INSERT INTO sync_queue (entityType, operation, payload, createdAt) VALUES ('vehicle', ?, ?, ?)`,
      operation,
      payload,
      '2026-10-11'
    );
    const original = rows();
    const id = await choice();
    await expect(access.confirmAccountDataChoice(id, { kind: 'add' })).rejects.toThrow('pending device changes');
    expect(rows()).toEqual(original);
    expect(await owner.getSyncOwner()).toBeNull();
  });
  it('preserves adoption and pending jobs after upload failure, and never sends them as another user', async () => {
    await pendingVehicle();
    const id = await choice();
    await access.confirmAccountDataChoice(id, { kind: 'add' });
    const { pushAdoptedData } = await import('../../../src/services/account/pushAdoptedData');
    mocks.createAdopted.mockRejectedValueOnce(new Error('Offline'));
    await expect(pushAdoptedData('account-A')).rejects.toThrow('Offline');
    expect(readRows('SELECT * FROM sync_queue')).toHaveLength(1);
    expect(readRows('SELECT * FROM account_adoption_queue')).toHaveLength(1);
    await expect(pushAdoptedData('account-B')).rejects.toThrow('another account');
    expect(mocks.createAdopted).toHaveBeenCalledOnce();
  });
  it('finishes guarded adoption uploads before normal push or pull, retaining jobs after a collision', async () => {
    await pendingVehicle();
    const id = await choice();
    await access.confirmAccountDataChoice(id, { kind: 'add' });
    mocks.createAdopted.mockRejectedValueOnce(new Error('Account conflict'));
    const { processSyncQueue } = await import('../../../src/services/sync/syncService');
    await expect(processSyncQueue()).rejects.toThrow('Account conflict');
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(readRows('SELECT * FROM sync_queue')).toHaveLength(1);
    expect(await owner.getPullCursor('account-A')).toBe(1);
  });
  it('does not acknowledge mutations made after adoption while acknowledging older upserts', async () => {
    await pendingVehicle();
    const id = await choice();
    await access.confirmAccountDataChoice(id, { kind: 'add' });
    await pendingVehicle('New edit after binding');
    const { pushAdoptedData } = await import('../../../src/services/account/pushAdoptedData');
    await pushAdoptedData('account-A');
    expect(readRows<{ payload: string }>('SELECT payload FROM sync_queue')).toHaveLength(1);
    expect(JSON.parse(readRows<{ payload: string }>('SELECT payload FROM sync_queue')[0].payload).label).toBe(
      'New edit after binding'
    );
  });
  it('retries activation without repeating a committed replacement or permitting a different data choice', async () => {
    const id = await choice();
    mocks.set.mockRejectedValueOnce(new Error('Secure storage unavailable'));
    await expect(access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: true })).rejects.toThrow(
      'data choice is saved'
    );
    const records = readRows('SELECT * FROM vehicles');
    const preflightCalls = mocks.pullAccount.mock.calls.length;
    await expect(access.confirmAccountDataChoice(id, { kind: 'add' })).rejects.toThrow('already saved');
    await access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: true });
    expect(readRows('SELECT * FROM vehicles')).toEqual(records);
    expect(mocks.pullAccount).toHaveBeenCalledTimes(preflightCalls);
  });
  it('never treats an incomplete owner binding as freely adoptable local data', async () => {
    execute("INSERT INTO sync_state (key, value) VALUES ('sync_owner_id', 'account-B')");
    const original = rows();
    await expect(access.signIn('me@example.com', 'password')).rejects.toThrow('ownership could not be verified');
    expect(rows()).toEqual(original);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('requires explicit replacement confirmation before any remote read or deletion', async () => {
    const original = rows();
    const id = await choice();
    // @ts-expect-error Simulate an invalid caller; runtime consent must also be checked.
    await expect(access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: false })).rejects.toThrow(
      'Confirm replacement'
    );
    expect(rows()).toEqual(original);
    expect(mocks.pullAccount).not.toHaveBeenCalled();
  });
  it('preserves a full local dataset and allows retry when remote replacement preflight fails', async () => {
    seedEntries();
    await pendingVehicle();
    await owner.setPullCursor('old-local-cursor', 17);
    await database.runAsync("INSERT INTO sync_state (key, value) VALUES ('appearance', 'dark')");
    const original = rows();
    const id = await choice();
    mocks.pullAccount.mockRejectedValueOnce(new Error('Offline'));
    await expect(access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: true })).rejects.toThrow(
      'unchanged'
    );
    expect(rows()).toEqual(original);
    expect(mocks.secure.size).toBe(0);
    await access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: true });
    expect(readRows<{ clientId: string }>('SELECT clientId FROM vehicles')).toEqual([{ clientId: 'cloud-vehicle' }]);
    expect(readRows('SELECT * FROM sync_queue')).toEqual([]);
    for (const table of [
      'fuel_entries',
      'charging_entries',
      'maintenance_entries',
      'ownership_expenses',
      'recurring_expenses',
    ])
      expect(readRows(`SELECT * FROM ${table}`)).toEqual([]);
    expect(readRows("SELECT * FROM sync_state WHERE key = 'appearance'")).toHaveLength(1);
    expect(readRows("SELECT * FROM sync_state WHERE key = 'pull_cursor:old-local-cursor'")).toEqual([]);
    expect(await owner.getPullCursor('account-A')).toBe(1);
  });
  it('preserves the installation when a later page of remote replacement data cannot be obtained', async () => {
    const id = await choice();
    const original = rows();
    mocks.pullAccount.mockResolvedValueOnce(feed).mockRejectedValueOnce(new Error('Second page unavailable'));
    await expect(access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: true })).rejects.toThrow(
      'unchanged'
    );
    expect(rows()).toEqual(original);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it.each(['add', 'replace'] as const)(
    'rolls back %s, remote import and owner binding together when binding is interrupted',
    async kind => {
      await pendingVehicle();
      const original = rows();
      const id = await choice();
      execute(
        "CREATE TRIGGER fail_binding BEFORE INSERT ON sync_state WHEN NEW.key = 'sync_owner_mode' BEGIN SELECT RAISE(ABORT, 'Binding interrupted'); END;"
      );
      const decision = kind === 'add' ? { kind } : { kind, confirmed: true as const };
      await expect(access.confirmAccountDataChoice(id, decision)).rejects.toThrow('unchanged');
      expect(rows()).toEqual(original);
      expect(mocks.secure.size).toBe(0);
      execute('DROP TRIGGER fail_binding');
      await access.confirmAccountDataChoice(id, decision);
      expect(await owner.getSyncOwner()).toEqual({ userId: 'account-A', mode: 'registered' });
    }
  );
  it('leaves no dormant credentials or data changes when the choice is cancelled', async () => {
    await pendingVehicle();
    const original = rows();
    const id = await choice();
    access.cancelSignIn(id);
    expect(rows()).toEqual(original);
    expect(mocks.secure.size).toBe(0);
    expect(mocks.logout).toHaveBeenCalledWith('refresh-A');
    expect(mocks.pullAccount).not.toHaveBeenCalled();
    await expect(access.confirmAccountDataChoice(id, { kind: 'add' })).rejects.toThrow('Sign in again');
  });
  it('cancels a replacement during remote preflight without erasing or binding local records', async () => {
    let resolve!: (page: PullResponse) => void;
    mocks.pullAccount.mockReturnValue(
      new Promise<PullResponse>(done => {
        resolve = done;
      })
    );
    const original = rows();
    const id = await choice();
    const saving = access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: true });
    const cancelled = expect(saving).rejects.toThrow('cancelled');
    access.cancelSignIn(id);
    resolve({ data: [], nextCursor: 0 });
    await cancelled;
    expect(rows()).toEqual(original);
    expect(mocks.secure.size).toBe(0);
  });
  it('rechecks the dataset before commit so remote preflight cannot erase new local changes', async () => {
    const id = await choice();
    await database.runAsync("UPDATE vehicles SET label = 'New local edit' WHERE id = 1");
    const original = rows();
    await expect(access.confirmAccountDataChoice(id, { kind: 'replace', confirmed: true })).rejects.toThrow(
      'Device records changed'
    );
    expect(rows()).toEqual(original);
  });
  it.each(['add', 'replace'] as const)(
    'recovers an interrupted %s activation on restart using only the committed owner',
    async kind => {
      const id = await choice();
      mocks.set.mockRejectedValueOnce(new Error('Secure storage unavailable'));
      const decision = kind === 'add' ? { kind } : { kind, confirmed: true as const };
      await expect(access.confirmAccountDataChoice(id, decision)).rejects.toThrow('data choice is saved');
      expect(await owner.isSessionBlocked()).toBe(true);
      expect(await owner.getSyncOwner()).toEqual({ userId: 'account-A', mode: 'registered' });
      const committed = readRows('SELECT * FROM vehicles');
      vi.resetModules();
      auth = await import('../../../src/services/sync/authSession');
      expect(await auth.initializeAuthSession()).toBe('reauth-required');
      access = await import('../../../src/services/account/accountAccess');
      mocks.login.mockResolvedValueOnce({ ...account, user: { ...account.user, id: 'account-B' } });
      await expect(access.signIn('other@example.com', 'password')).rejects.toThrow('linked to another account');
      expect(readRows('SELECT * FROM vehicles')).toEqual(committed);
      await expect(access.signIn('me@example.com', 'password')).resolves.toEqual({ tag: 'signed-in' });
      expect(readRows('SELECT * FROM vehicles')).toEqual(committed);
      expect(await owner.isSessionBlocked()).toBe(false);
    }
  );
});

describe('safe sign-out', () => {
  async function signInOwner() {
    await owner.bindSyncOwner({ userId: 'account-A', mode: 'registered' });
    await owner.setPullCursor('account-A', 25);
    await pendingVehicle();
    await access.signIn('me@example.com', 'password');
  }
  it('works offline without waiting for revocation, preserves data/jobs/cursor, and restarts signed out', async () => {
    seedEntries();
    await signInOwner();
    const data = rows().slice(0, 7);
    mocks.logout.mockReturnValue(new Promise(() => {}));
    await access.signOut();
    expect(rows().slice(0, 7)).toEqual(data);
    expect(mocks.secure.size).toBe(0);
    expect(await owner.getSyncOwner()).toEqual({ userId: 'account-A', mode: 'registered' });
    expect(await owner.getPullCursor('account-A')).toBe(25);
    vi.resetModules();
    auth = await import('../../../src/services/sync/authSession');
    expect(await auth.initializeAuthSession()).toBe('reauth-required');
    expect(auth.getMobileSession()).toBeNull();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('removes the retired access-token credential as well as the current session on sign-out', async () => {
    await signInOwner();
    mocks.secure.set('drivecost.access-token', 'retired-access-token');
    await access.signOut();
    expect(mocks.secure.size).toBe(0);
  });
  it('cannot restore old credentials after an interrupted secure-storage deletion', async () => {
    await signInOwner();
    mocks.remove.mockRejectedValueOnce(new Error('Secure storage unavailable'));
    await expect(access.signOut()).rejects.toThrow('Secure storage unavailable');
    expect(mocks.secure.size).toBe(1);
    expect(await owner.isSessionBlocked()).toBe(true);
    vi.resetModules();
    auth = await import('../../../src/services/sync/authSession');
    expect(await auth.initializeAuthSession()).toBe('reauth-required');
    expect(auth.getMobileSession()).toBeNull();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('pauses an active push and retains its pending job instead of continuing sync after sign-out', async () => {
    await signInOwner();
    let resolve!: () => void;
    mocks.sync.mockReturnValue(
      new Promise<void>(done => {
        resolve = done;
      })
    );
    const { processSyncQueue } = await import('../../../src/services/sync/syncService');
    const syncing = processSyncQueue();
    await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledOnce());
    await access.signOut();
    resolve();
    await syncing;
    expect(readRows('SELECT * FROM sync_queue')).toHaveLength(1);
    expect(mocks.pull).not.toHaveBeenCalled();
  });
  it('does not import a late pull response or advance its cursor after sign-out', async () => {
    await signInOwner();
    execute('DELETE FROM sync_queue');
    let resolve!: (page: PullResponse) => void;
    mocks.pull.mockReturnValue(
      new Promise<PullResponse>(done => {
        resolve = done;
      })
    );
    const { processSyncQueue } = await import('../../../src/services/sync/syncService');
    const syncing = processSyncQueue();
    await vi.waitFor(() => expect(mocks.pull).toHaveBeenCalledOnce());
    await access.signOut();
    resolve({ ...feed, data: feed.data.map(change => ({ ...change, sequence: 26 })), nextCursor: 26 });
    await syncing;
    expect(readRows('SELECT * FROM vehicles')).toHaveLength(1);
    expect(await owner.getPullCursor('account-A')).toBe(25);
  });
  it('requires the same owner after sign-out and restores that owner without changing the cursor', async () => {
    await signInOwner();
    await access.signOut();
    const data = rows().slice(0, 7);
    mocks.login.mockResolvedValueOnce({ ...account, user: { ...account.user, id: 'account-B' } });
    await expect(access.signIn('other@example.com', 'password')).rejects.toThrow('linked to another account');
    expect(rows().slice(0, 7)).toEqual(data);
    expect(auth.getMobileSession()).toBeNull();
    expect(await access.signIn('me@example.com', 'password')).toEqual({ tag: 'signed-in' });
    expect(await owner.getPullCursor('account-A')).toBe(25);
    expect(auth.getMobileSession()?.userId).toBe('account-A');
  });
  it('keeps recording entries locally after sign-out without sending them to the cloud', async () => {
    await signInOwner();
    await access.signOut();
    const { useFuelStore } = await import('../../../src/store/fuelStore');
    await useFuelStore.getState().createFuelEntry({
      vehicleId: 1,
      liters: 40,
      price: 60,
      odometer: 1200,
      date: '2026-10-12T00:00:00.000Z',
      fillStatus: 'full',
    });
    const { processSyncQueue } = await import('../../../src/services/sync/syncService');
    await processSyncQueue();
    expect(readRows('SELECT * FROM fuel_entries')).toHaveLength(1);
    expect(readRows('SELECT * FROM sync_queue')).toHaveLength(3);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.pull).not.toHaveBeenCalled();
  });
  it('keeps a late adoption-upload failure from overriding signed-out status or acknowledging pending jobs', async () => {
    await pendingVehicle();
    const id = await choice();
    await access.confirmAccountDataChoice(id, { kind: 'add' });
    let reject!: (error: Error) => void;
    mocks.createAdopted.mockReturnValue(
      new Promise<void>((_, fail) => {
        reject = fail;
      })
    );
    const { processSyncQueue, subscribeToSyncStatus } = await import('../../../src/services/sync/syncService');
    const phases: string[] = [];
    const unsubscribe = subscribeToSyncStatus(status => phases.push(status.phase));
    const syncing = processSyncQueue();
    await vi.waitFor(() => expect(mocks.createAdopted).toHaveBeenCalledOnce());
    await access.signOut();
    reject(new Error('Offline'));
    await syncing;
    unsubscribe();
    expect(phases.at(-1)).toBe('auth-required');
    expect(readRows('SELECT * FROM sync_queue')).toHaveLength(1);
    expect(readRows('SELECT * FROM account_adoption_queue')).toHaveLength(1);
  });
});
