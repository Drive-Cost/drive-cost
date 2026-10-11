import { describe, expect, it } from 'vitest';
import { reduce, initialState } from '../../../src/screens/CreateAccount/reducer';
import {
    accountCreationErrorMessage,
    validateAccountCreation,
} from '../../../src/domain/accountValidation';

describe('account form transitions', () => {
    it('keeps the submitted inputs stable until the request finishes', () => {
        let state = initialState();
        state = reduce(state, { type: 'edit', field: 'password', value: 'a long password' });
        state = reduce(state, { type: 'submit' });
        expect(state.tag).toBe('submitting');
        expect(reduce(state, { type: 'edit', field: 'password', value: 'changed' })).toBe(state);
        expect(reduce(state, { type: 'submit' })).toBe(state);
    });

    it('restores an editable form on failure and clears the error when correcting a field', () => {
        const submitting = reduce(initialState(), { type: 'submit' });
        const failed = reduce(submitting, { type: 'error', message: 'Try again.' });
        expect(failed).toMatchObject({ tag: 'editing', error: 'Try again.' });
        expect(reduce(failed, { type: 'edit', field: 'email', value: 'me@example.com' })).toMatchObject({
            tag: 'editing',
            error: null,
            input: { email: 'me@example.com' },
        });
    });

    it('accepts success only after submission and removes passwords from the completed state', () => {
        const initial = initialState();
        expect(reduce(initial, { type: 'success' })).toBe(initial);
        const editing = {
            ...initial,
            input: { email: 'me@example.com', password: 'a long password', confirmation: 'a long password' },
        };
        const completed = reduce(reduce(editing, { type: 'submit' }), { type: 'success' });
        expect(completed).toEqual({
            tag: 'succeeded',
            input: { email: 'me@example.com', password: '', confirmation: '' },
        });
        expect(reduce(completed, { type: 'error', message: 'late error' })).toBe(completed);
    });

    it('validates trimmed email, password length, and confirmation', () => {
        const valid = { email: ' me@example.com ', password: 'a long password', confirmation: 'a long password' };
        expect(validateAccountCreation(valid)).toBeNull();
        expect(validateAccountCreation({ ...valid, email: 'invalid' })).toContain('email');
        expect(validateAccountCreation({ ...valid, password: 'short' })).toContain('12 characters');
        expect(validateAccountCreation({ ...valid, confirmation: 'different' })).toContain('do not match');
    });

    it('maps known service errors and hides unknown implementation details', () => {
        expect(accountCreationErrorMessage({ status: 409 })).toContain('already exists');
        expect(accountCreationErrorMessage({ status: 429 })).toContain('Too many attempts');
        expect(accountCreationErrorMessage({ status: 400 })).toContain('Check your details');
        expect(accountCreationErrorMessage(new Error('SQL failure'))).toContain('local data is safe');
    });
});
