export type State = { password: string; busy: boolean; error: string | null };
export type Action =
  | { type: 'password'; value: string }
  | { type: 'submit' }
  | { type: 'finished' }
  | { type: 'failed'; message: string };
export const initialState: State = { password: '', busy: false, error: null };
export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'password':
      return state.busy ? state : { ...state, password: action.value, error: null };
    case 'submit':
      return state.busy ? state : { password: '', busy: true, error: null };
    case 'finished':
      return { ...state, busy: false };
    case 'failed':
      return { password: '', busy: false, error: action.message };
  }
}
