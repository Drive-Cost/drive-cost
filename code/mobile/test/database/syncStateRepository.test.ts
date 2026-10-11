import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../src/database/db', async () => ({ db: (await import('../helpers/memorySqlite')).database }));
import { closeDatabase, execute, resetDatabase } from '../helpers/memorySqlite';
import { bindSyncOwner, getSyncOwner } from '../../src/database/syncStateRepository';

beforeEach(resetDatabase);
afterEach(closeDatabase);

it('updates owner ID and mode atomically, retaining the previous binding on failure', async () => {
  await bindSyncOwner({ userId: 'user-1', mode: 'guest' });
  execute(
    "CREATE TRIGGER fail_mode BEFORE INSERT ON sync_state WHEN NEW.key = 'sync_owner_mode' BEGIN SELECT RAISE(ABORT, 'Mode failure'); END;"
  );
  await expect(bindSyncOwner({ userId: 'user-2', mode: 'registered' })).rejects.toThrow('Mode failure');
  expect(await getSyncOwner()).toEqual({ userId: 'user-1', mode: 'guest' });
});
