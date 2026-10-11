import type { VehicleCreateFormInput as Input } from '../../domain/formValidation';

export type State = { input: Input } & (
  | { tag: 'editing'; error: string | null }
  | { tag: 'saving' }
  | { tag: 'saved' }
);
export type Action =
  | { type: 'change'; field: keyof Input; value: string }
  | { type: 'error'; message: string }
  | { type: 'save' }
  | { type: 'saved' };

export function initialState(): State {
  return {
    tag: 'editing',
    input: { brand: '', model: '', year: '', vehicleType: '', currentOdometer: '' },
    error: null,
  };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'change':
      return state.tag === 'editing'
        ? { ...state, input: { ...state.input, [action.field]: action.value }, error: null }
        : state;
    case 'error':
      return state.tag === 'saved' ? state : { tag: 'editing', input: state.input, error: action.message };
    case 'save':
      return state.tag === 'editing' ? { tag: 'saving', input: state.input } : state;
    case 'saved':
      return state.tag === 'saving' ? { ...state, tag: 'saved' } : state;
  }
}
