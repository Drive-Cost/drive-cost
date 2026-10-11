import { expect, it, vi } from 'vitest';
import { createSubmissionGuard } from '../../../src/services/app/submissionGuard';

it('ignores repeated taps while pending, then permits retry after failure', async () => {
  const guard = createSubmissionGuard();
  let reject!: (error: Error) => void;
  const write = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      })
  );
  const pending = guard(write);
  const failed = expect(pending).rejects.toThrow('Unable to save');
  await guard(write);
  expect(write).toHaveBeenCalledOnce();
  reject(new Error('Unable to save'));
  await failed;
  const retry = vi.fn().mockResolvedValue(undefined);
  await guard(retry);
  expect(retry).toHaveBeenCalledOnce();
});
