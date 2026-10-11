import { beforeEach, afterEach, expect, it } from 'vitest';
import { resetDatabase, closeDatabase, execute, readRows } from '../helpers/memorySqlite';
import { migrateAccountAdoption } from '../../src/database/migrations/accountAdoption';

beforeEach(resetDatabase);
afterEach(closeDatabase);
it('adds the durable adoption queue to an existing dataset and can be rerun without losing rows or metadata', () => {
  execute(
    "DROP TABLE account_adoption_queue; INSERT INTO sync_state (key, value) VALUES ('pull_cursor:account-A', '25');"
  );
  const vehicles = readRows('SELECT * FROM vehicles');
  migrateAccountAdoption({ execSync: execute });
  execute("INSERT INTO account_adoption_queue VALUES ('account-A', 'vehicle', 'vehicle-1', '{}', 1)");
  migrateAccountAdoption({ execSync: execute });
  expect(readRows('SELECT * FROM account_adoption_queue')).toHaveLength(1);
  expect(readRows('SELECT * FROM vehicles')).toEqual(vehicles);
  expect(readRows('SELECT * FROM sync_state')).toEqual([{ key: 'pull_cursor:account-A', value: '25' }]);
});
