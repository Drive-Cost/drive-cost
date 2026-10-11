import { describe, expect, it, vi } from 'vitest';
import { createSyncScheduler } from '../../../src/services/sync/syncScheduler';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('sync scheduling', () => {
  it('coalesces pre-start requests and runs one extra pass for writes made during a pass', async () => {
    const first = deferred();
    const second = deferred();
    const run = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const scheduler = createSyncScheduler(run);
    const pending = scheduler.request();
    expect(scheduler.request()).toBe(pending);
    await Promise.resolve();
    expect(run).toHaveBeenCalledOnce();
    expect(scheduler.request()).toBe(pending);
    expect(scheduler.request()).toBe(pending);
    first.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
    second.resolve();
    await pending;
  });

  it('does not run concurrent passes when more writes arrive during the follow-up', async () => {
    const first = deferred();
    const second = deferred();
    const run = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(undefined);
    const scheduler = createSyncScheduler(run);
    const pending = scheduler.request();
    await Promise.resolve();
    void scheduler.request();
    first.resolve();
    await Promise.resolve();
    void scheduler.request();
    expect(run).toHaveBeenCalledTimes(2);
    second.resolve();
    await pending;
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('leaves failures recoverable without spinning or blocking the next manual request', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('Offline.')).mockResolvedValue(undefined);
    const scheduler = createSyncScheduler(run);
    await expect(scheduler.request()).rejects.toThrow('Offline.');
    expect(run).toHaveBeenCalledOnce();
    await scheduler.request();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not lose a request made as the previous pass finishes', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const scheduler = createSyncScheduler(run);
    const first = scheduler.request();
    await Promise.resolve();
    await Promise.resolve();
    const next = scheduler.request();
    await Promise.all([first, next]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('retries a requested follow-up after a failed active pass and reports the latest outcome', async () => {
    const first = deferred();
    const run = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const scheduler = createSyncScheduler(run);
    const pending = scheduler.request();
    await Promise.resolve();
    void scheduler.request();
    first.reject(new Error('Temporary failure.'));
    await pending;
    expect(run).toHaveBeenCalledTimes(2);
  });
});
