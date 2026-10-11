export type Input = { date: string; kWh: string; price: string; odometer: string };
export type State = { form: Input } & ({ tag: 'editing'; error: string | null } | { tag: 'saving' } | { tag: 'saved' });
export type Action =
  | { type: 'change'; field: keyof Input; value: string }
  | { type: 'reset'; input: Input }
  | { type: 'error'; message: string | null }
  | { type: 'save' }
  | { type: 'saved' };

export function initialState(input: Input): State {
  return { tag: 'editing', form: input, error: null };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'change':
      return state.tag === 'editing'
        ? { ...state, form: { ...state.form, [action.field]: action.value }, error: null }
        : state;
    case 'reset':
      return initialState(action.input);
    case 'error':
      return state.tag === 'saved' ? state : { tag: 'editing', form: state.form, error: action.message };
    case 'save':
      return state.tag === 'editing' ? { tag: 'saving', form: state.form } : state;
    case 'saved':
      return state.tag === 'saving' ? { ...state, tag: 'saved' } : state;
  }
}
