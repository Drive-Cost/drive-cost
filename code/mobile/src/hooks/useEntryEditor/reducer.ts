export type EditableEntry = {
  id: number;
  vehicleId: number;
};

export type State<Entry, Form> = ({ tag: 'creating'; editingEntry: null } | { tag: 'editing'; editingEntry: Entry }) & {
  formInput: Form;
  error: string | null;
};

export type Action<Entry, Form> =
  | { type: 'change'; field: keyof Form; value: string }
  | { type: 'edit'; entry: Entry; formInput: Form }
  | { type: 'reset'; formInput: Form }
  | { type: 'vehicleChanged'; vehicleId: number | null; formInput: Form }
  | { type: 'deleted'; entryId: number; formInput: Form }
  | { type: 'error'; message: string | null };

export function initialState<Entry, Form>(formInput: Form): State<Entry, Form> {
  return { tag: 'creating', editingEntry: null, formInput, error: null };
}

// Dates and entry-to-form conversion are supplied by the caller so transitions stay pure.
export function reduce<Entry extends EditableEntry, Form extends { [Field in keyof Form]: string }>(
  state: State<Entry, Form>,
  action: Action<Entry, Form>
): State<Entry, Form> {
  switch (action.type) {
    case 'change':
      return { ...state, formInput: { ...state.formInput, [action.field]: action.value }, error: null };
    case 'edit':
      return { tag: 'editing', editingEntry: action.entry, formInput: action.formInput, error: null };
    case 'reset':
      return initialState(action.formInput);
    case 'vehicleChanged':
      return state.tag === 'editing' && state.editingEntry.vehicleId !== action.vehicleId
        ? initialState(action.formInput)
        : state;
    case 'deleted':
      return state.tag === 'editing' && state.editingEntry.id === action.entryId
        ? initialState(action.formInput)
        : state;
    case 'error':
      return { ...state, error: action.message };
  }
}
