export type EditableEntry = {
  id: number;
  vehicleId: number;
};

export type State<Entry, Form> = (
  | { tag: 'creating'; editingEntry: null }
  | { tag: 'editing'; editingEntry: Entry }
  | { tag: 'saving'; editingEntry: Entry | null; submission: number }
) & {
  formInput: Form;
  error: string | null;
};

export type Action<Entry, Form> =
  | { type: 'change'; field: keyof Form; value: string }
  | { type: 'edit'; entry: Entry; formInput: Form }
  | { type: 'reset'; formInput: Form }
  | { type: 'vehicleChanged'; vehicleId: number | null; formInput: Form }
  | { type: 'deleted'; entryId: number; formInput: Form }
  | { type: 'error'; message: string | null }
  | { type: 'save'; submission: number }
  | { type: 'saved'; submission: number; formInput: Form }
  | { type: 'failed'; submission: number; message: string };

export function initialState<Entry, Form>(formInput: Form): State<Entry, Form> {
  return { tag: 'creating', editingEntry: null, formInput, error: null };
}

// Dates and entry-to-form conversion are supplied by the caller so transitions stay pure.
export function reduce<Entry extends EditableEntry, Form extends { [Field in keyof Form]: string }>(
  state: State<Entry, Form>,
  action: Action<Entry, Form>
): State<Entry, Form> {
  if (state.tag === 'saving' && ['change', 'edit', 'reset', 'error', 'save'].includes(action.type)) return state;
  switch (action.type) {
    case 'save':
      return { ...state, tag: 'saving', submission: action.submission, error: null };
    case 'saved':
      return state.tag === 'saving' && state.submission === action.submission ? initialState(action.formInput) : state;
    case 'failed': {
      if (state.tag !== 'saving' || state.submission !== action.submission) return state;
      if (state.editingEntry) {
        return { tag: 'editing', editingEntry: state.editingEntry, formInput: state.formInput, error: action.message };
      }
      return { ...initialState<Entry, Form>(state.formInput), error: action.message };
    }
    case 'change':
      return { ...state, formInput: { ...state.formInput, [action.field]: action.value }, error: null };
    case 'edit':
      return { tag: 'editing', editingEntry: action.entry, formInput: action.formInput, error: null };
    case 'reset':
      return initialState(action.formInput);
    case 'vehicleChanged':
      return state.editingEntry?.vehicleId === action.vehicleId ? state : initialState(action.formInput);
    case 'deleted':
      return state.editingEntry !== null && state.editingEntry.id === action.entryId
        ? initialState(action.formInput)
        : state;
    case 'error':
      return { ...state, error: action.message };
  }
}
