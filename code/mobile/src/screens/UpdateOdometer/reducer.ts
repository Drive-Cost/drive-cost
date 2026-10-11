export type State = { odometer: string } & (
  | { tag: 'editing'; error: string | null }
  | { tag: 'saving' }
  | { tag: 'saved' }
);
export type Action =
  | { type: 'change'; value: string }
  | { type: 'error'; message: string }
  | { type: 'save' }
  | { type: 'saved' };

export function initialState(odometer: string): State {
  return { tag: 'editing', odometer, error: null };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'change':
      return state.tag === 'editing' ? { ...state, odometer: action.value, error: null } : state;
    case 'error':
      return state.tag === 'saved' ? state : { tag: 'editing', odometer: state.odometer, error: action.message };
    case 'save':
      return state.tag === 'editing' ? { tag: 'saving', odometer: state.odometer } : state;
    case 'saved':
      return state.tag === 'saving' ? { ...state, tag: 'saved' } : state;
  }
}
