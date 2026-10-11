type Input = { email: string; password: string };

export type State =
  | { tag: 'editing'; input: Input; error: string | null }
  | { tag: 'submitting'; input: Input }
  | { tag: 'succeeded'; input: Input };

export type Action =
  | { type: 'edit'; field: keyof Input; value: string }
  | { type: 'submit' }
  | { type: 'error'; message: string }
  | { type: 'success' };

export function initialState(): State {
  return { tag: 'editing', input: { email: '', password: '' }, error: null };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'edit':
      return state.tag === 'editing'
        ? { tag: 'editing', input: { ...state.input, [action.field]: action.value }, error: null }
        : state;
    case 'submit':
      return state.tag === 'editing' ? { tag: 'submitting', input: state.input } : state;
    case 'error':
      return state.tag === 'succeeded' ? state : { tag: 'editing', input: state.input, error: action.message };
    case 'success':
      return state.tag === 'submitting'
        ? { tag: 'succeeded', input: { email: state.input.email, password: '' } }
        : state;
  }
}
