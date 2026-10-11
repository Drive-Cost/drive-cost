import type { SyncOwnerBinding } from '../../database/syncStateRepository';

export type State =
  | { tag: 'loading'; owner: null }
  | { tag: 'ready'; owner: SyncOwnerBinding | null }
  | { tag: 'error'; owner: null };
export type Action = { type: 'load' } | { type: 'loaded'; owner: SyncOwnerBinding | null } | { type: 'failed' };

export const initialState: State = { tag: 'loading', owner: null };

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return initialState;
    case 'loaded':
      return state.tag === 'loading' ? { tag: 'ready', owner: action.owner } : state;
    case 'failed':
      return state.tag === 'loading' ? { tag: 'error', owner: null } : state;
  }
}
