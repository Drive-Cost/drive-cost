import { expect, it } from 'vitest';
import { initialState, reduce } from '../../../src/screens/AccountDataChoice/reducer';

it('guards a pending decision and allows retry after a safe preflight failure', () => {
  const replacing = reduce(initialState, { type: 'choose', choice: 'replace' });
  expect(reduce(replacing, { type: 'choose', choice: 'add' })).toBe(replacing);
  const failed = reduce(replacing, { type: 'failed', message: 'Device data is unchanged. Try again.' });
  expect(failed).toEqual({ tag: 'ready', error: 'Device data is unchanged. Try again.' });
  expect(reduce(failed, { type: 'choose', choice: 'replace' })).toEqual(replacing);
  expect(reduce(reduce(replacing, { type: 'succeeded' }), { type: 'failed', message: 'Late error' })).toEqual({
    tag: 'succeeded',
  });
});

it('offers only connection retry after the data choice has already committed', () => {
  const replacing = reduce(initialState, { type: 'choose', choice: 'replace' });
  const failed = reduce(replacing, { type: 'failed', message: 'Your data choice is saved.', committed: true });
  expect(failed).toEqual({ tag: 'connection-error', choice: 'replace', error: 'Your data choice is saved.' });
  expect(reduce(failed, { type: 'choose', choice: 'add' })).toBe(failed);
  expect(reduce(failed, { type: 'choose', choice: 'replace' })).toEqual(replacing);
});
