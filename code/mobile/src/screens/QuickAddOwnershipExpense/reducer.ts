export type Input = {
  category: string;
  totalPaid: string;
  date: string;
  odometer: string;
  description: string;
};

export type State = { input: Input; showOptionalDetails: boolean } & (
  | { tag: 'editing'; error: string | null }
  | { tag: 'saving' }
  | { tag: 'saved' }
);

export type Action =
  | { type: 'edit'; field: keyof Input; value: string }
  | { type: 'showOptionalDetails' }
  | { type: 'save' }
  | { type: 'saved' }
  | { type: 'error'; message: string };

export function initialState(date: string): State {
  return {
    tag: 'editing',
    input: { category: '', totalPaid: '', date, odometer: '', description: '' },
    showOptionalDetails: false,
    error: null,
  };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'edit':
      return state.tag === 'editing'
        ? { ...state, input: { ...state.input, [action.field]: action.value }, error: null }
        : state;
    case 'showOptionalDetails':
      return state.tag === 'editing' ? { ...state, showOptionalDetails: true } : state;
    case 'save':
      return state.tag === 'editing'
        ? { tag: 'saving', input: state.input, showOptionalDetails: state.showOptionalDetails }
        : state;
    case 'saved':
      return state.tag === 'saving' ? { ...state, tag: 'saved' } : state;
    case 'error':
      return state.tag === 'saved' ? state : { ...state, tag: 'editing', error: action.message };
  }
}
