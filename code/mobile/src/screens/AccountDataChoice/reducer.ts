import type { AccountDataChoice } from '../../services/account/accountAccess';

export type State =
  | { tag: 'ready'; error: string | null }
  | { tag: 'working'; choice: AccountDataChoice['kind'] }
  | { tag: 'connection-error'; choice: AccountDataChoice['kind']; error: string }
  | { tag: 'succeeded' };
export type Action =
  | { type: 'choose'; choice: AccountDataChoice['kind'] }
  | { type: 'failed'; message: string; committed?: boolean }
  | { type: 'succeeded' };
export const initialState: State = { tag: 'ready', error: null };
export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'choose':
      return state.tag === 'ready' || (state.tag === 'connection-error' && state.choice === action.choice)
        ? { tag: 'working', choice: action.choice }
        : state;
    case 'failed':
      return state.tag === 'working'
        ? action.committed
          ? { tag: 'connection-error', choice: state.choice, error: action.message }
          : { tag: 'ready', error: action.message }
        : state;
    case 'succeeded':
      return state.tag === 'working' ? { tag: 'succeeded' } : state;
  }
}
