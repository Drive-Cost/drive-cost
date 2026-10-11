import { describe, expect, it, vi } from 'vitest';
import { createVehicleEntryLoader, mergeVehicleEntries } from '../../src/store/vehicleEntryLoader';
import type { LoadState } from '../../src/store/vehicleEntryLoader';

type Entry = { vehicleId: number; id: number };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function setup() {
  let entries: Entry[] = [];
  const statuses = new Map<number, LoadState>();
  const read = vi.fn<(vehicleId: number) => Promise<Entry[]>>();
  const loader = createVehicleEntryLoader(
    read,
    (id, snapshot) => {
      entries = mergeVehicleEntries(entries, id, snapshot);
    },
    (id, status) => {
      statuses.set(id, status);
    }
  );
  return { loader, read, statuses, entries: () => entries };
}

describe('vehicle entry reads', () => {
  it('keeps both vehicles when their loads complete out of order', async () => {
    const { loader, read, entries } = setup();
    const older = deferred<Entry[]>();
    read.mockReturnValueOnce(older.promise).mockResolvedValueOnce([{ vehicleId: 2, id: 20 }]);
    const pending = loader.load(1);
    await loader.load(2);
    older.resolve([{ vehicleId: 1, id: 10 }]);
    await pending;
    expect(entries()).toEqual([
      { vehicleId: 2, id: 20 },
      { vehicleId: 1, id: 10 },
    ]);
  });

  it('ignores stale successful reads and failures for the same vehicle', async () => {
    for (const failed of [false, true]) {
      const { loader, read, entries, statuses } = setup();
      const old = deferred<Entry[]>();
      read.mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ vehicleId: 1, id: 11 }]);
      const pending = loader.load(1);
      await loader.load(1);
      if (failed) old.reject(new Error('Stale failure'));
      else old.resolve([{ vehicleId: 1, id: 10 }]);
      await pending;
      expect(entries()).toEqual([{ vehicleId: 1, id: 11 }]);
      expect(statuses.get(1)).toEqual({ tag: 'ready' });
    }
  });

  it('cannot overwrite a committed write or deletion with an older read', async () => {
    const { loader, read, entries } = setup();
    const old = deferred<Entry[]>();
    read.mockReturnValue(old.promise);
    const pending = loader.load(1);
    loader.publish(1, []);
    old.resolve([{ vehicleId: 1, id: 10 }]);
    await pending;
    expect(entries()).toEqual([]);
  });

  it('exposes failure as a retryable state and distinguishes a successful empty result', async () => {
    const { loader, read, statuses, entries } = setup();
    read.mockRejectedValueOnce(new Error('SQLite read failed')).mockResolvedValueOnce([]);
    await loader.load(1);
    expect(statuses.get(1)).toEqual({ tag: 'error' });
    await loader.load(1);
    expect(statuses.get(1)).toEqual({ tag: 'ready' });
    expect(entries()).toEqual([]);
  });
});
