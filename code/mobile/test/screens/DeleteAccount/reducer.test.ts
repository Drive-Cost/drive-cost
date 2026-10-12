import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../../../src/screens/DeleteAccount/reducer';

describe('deletion confirmation reducer', () => {
  it('opening is idle, with no password and no destructive side effect', () => {
    expect(initialState).toEqual({ password: '', busy: false, error: null });
  });
  it('clears the password when submitting and ignores duplicate submits and edits until settled', () => {
    const edited = reduce(initialState, { type: 'password', value: 'private-password' });
    const submitting = reduce(edited, { type: 'submit' });
    expect(submitting).toEqual({ password: '', busy: true, error: null });
    expect(reduce(submitting, { type: 'submit' })).toBe(submitting);
    expect(reduce(submitting, { type: 'password', value: 'ignored' })).toBe(submitting);
  });
  it('allows a corrected password after failure and clears errors on edit', () => {
    const failed = reduce(reduce(initialState, { type: 'submit' }), {
      type: 'failed',
      message: 'Check your current password.',
    });
    expect(failed.busy).toBe(false);
    expect(failed.password).toBe('');
    expect(reduce(failed, { type: 'password', value: 'corrected' })).toEqual({
      password: 'corrected',
      busy: false,
      error: null,
    });
  });
});
