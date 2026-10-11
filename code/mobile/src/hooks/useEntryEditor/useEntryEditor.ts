import { useSubmissionGuard } from '../useSubmissionGuard';
import { entryErrorMessage, ENTRY_SAVE_FAILURE_MESSAGE } from '../../services/entries/entryError';
import { useCallback, useReducer, useRef } from 'react';
import { initialState, reduce } from './reducer';
import type { EditableEntry } from './reducer';

export function useEntryEditor<Entry extends EditableEntry, Form extends { [Field in keyof Form]: string }>(
  createEmptyForm: () => Form,
  toFormInput: (entry: Entry) => Form,
  reducer: typeof reduce<Entry, Form>
) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState<Entry, Form>(createEmptyForm()));

  const guard = useSubmissionGuard();
  const generation = useRef(0);
  const vehicle = useRef<number | null | undefined>(undefined);
  const submit = useCallback(
    async (write: () => Promise<void>, failureMessage = ENTRY_SAVE_FAILURE_MESSAGE) => {
      let saved = false;
      await guard(async () => {
        const submission = ++generation.current;
        dispatch({ type: 'save', submission });
        try {
          await write();
          dispatch({ type: 'saved', submission, formInput: createEmptyForm() });
          saved = generation.current === submission;
        } catch (error) {
          dispatch({ type: 'failed', submission, message: entryErrorMessage(error, failureMessage) });
        }
      });
      return saved;
    },
    [guard, createEmptyForm]
  );

  const updateFormInput = useCallback((field: keyof Form, value: string) => {
    dispatch({ type: 'change', field, value });
  }, []);

  const setError = useCallback((message: string | null) => {
    dispatch({ type: 'error', message });
  }, []);

  const clearEditor = useCallback(() => {
    dispatch({ type: 'reset', formInput: createEmptyForm() });
  }, [createEmptyForm]);

  const startEditing = useCallback(
    (entry: Entry) => {
      dispatch({ type: 'edit', entry, formInput: toFormInput(entry) });
    },
    [toFormInput]
  );

  const cancelIfVehicleChanged = useCallback(
    (vehicleId: number | null) => {
      if (vehicle.current === vehicleId) return;
      vehicle.current = vehicleId;
      generation.current += 1;
      dispatch({ type: 'vehicleChanged', vehicleId, formInput: createEmptyForm() });
    },
    [createEmptyForm]
  );

  const clearIfEditing = useCallback(
    (entryId: number) => {
      dispatch({ type: 'deleted', entryId, formInput: createEmptyForm() });
    },
    [createEmptyForm]
  );

  return {
    ...state,
    isSaving: state.tag === 'saving',
    submit,
    setError,
    updateFormInput,
    clearEditor,
    startEditing,
    cancelIfVehicleChanged,
    clearIfEditing,
  };
}
