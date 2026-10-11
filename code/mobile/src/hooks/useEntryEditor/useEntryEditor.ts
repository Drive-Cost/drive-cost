import { useCallback, useReducer } from 'react';
import { initialState, reduce } from './reducer';
import type { EditableEntry } from './reducer';

export function useEntryEditor<Entry extends EditableEntry, Form extends { [Field in keyof Form]: string }>(
  createEmptyForm: () => Form,
  toFormInput: (entry: Entry) => Form,
  reducer: typeof reduce<Entry, Form>
) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState<Entry, Form>(createEmptyForm()));

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
    setError,
    updateFormInput,
    clearEditor,
    startEditing,
    cancelIfVehicleChanged,
    clearIfEditing,
  };
}
