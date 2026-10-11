import { describe, expect, it } from 'vitest';
import { initialState, reduce as reduceEditor } from '../../../src/hooks/useEntryEditor/reducer';

type Entry = { id: number; vehicleId: number; price: number };
type Form = { price: string; date: string };
const reduce = reduceEditor<Entry, Form>;
const empty = { price: '', date: '2026-10-09' };
const entry = { id: 7, vehicleId: 1, price: 50 };

describe('entry editor', () => {
    it('changes entry, inputs, and error atomically when editing starts', () => {
        const failed = reduce(initialState(empty), { type: 'error', message: 'Invalid price.' });
        const formInput = { ...empty, price: '50' };
        expect(reduce(failed, { type: 'edit', entry, formInput })).toEqual({
            tag: 'editing',
            editingEntry: entry,
            formInput,
            error: null,
        });
    });

    it('clears only an edit belonging to a different vehicle', () => {
        const editing = reduce(initialState(empty), {
            type: 'edit',
            entry,
            formInput: { ...empty, price: '50' },
        });
        expect(reduce(editing, { type: 'vehicleChanged', vehicleId: 1, formInput: empty })).toBe(editing);
        expect(reduce(editing, { type: 'vehicleChanged', vehicleId: 2, formInput: empty })).toEqual(
            initialState(empty),
        );
        expect(reduce(editing, { type: 'vehicleChanged', vehicleId: null, formInput: empty })).toEqual(
            initialState(empty),
        );
    });

    it('clears the editor when its entry is deleted, preserving unrelated edits', () => {
        const editing = reduce(initialState(empty), {
            type: 'edit',
            entry,
            formInput: { ...empty, price: '50' },
        });
        expect(reduce(editing, { type: 'deleted', entryId: 8, formInput: empty })).toBe(editing);
        expect(reduce(editing, { type: 'deleted', entryId: 7, formInput: empty })).toEqual(
            initialState(empty),
        );
    });

    it('preserves other fields on correction and uses caller-supplied defaults on reset', () => {
        const failed = reduce(initialState(empty), { type: 'error', message: 'Invalid price.' });
        const changed = reduce(failed, { type: 'change', field: 'price', value: '25' });
        expect(changed).toMatchObject({ formInput: { price: '25', date: empty.date }, error: null });
        const nextDay = { ...empty, date: '2026-10-10' };
        expect(reduce(changed, { type: 'reset', formInput: nextDay })).toEqual(initialState(nextDay));
    });
});
