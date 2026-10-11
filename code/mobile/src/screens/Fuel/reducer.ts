import { reduce as reduceEditor } from '../../hooks/useEntryEditor/reducer';
import type { State as EditorState, Action as EditorAction } from '../../hooks/useEntryEditor/reducer';
import type { FuelEntry } from '../../models/FuelEntry';

export type Input = { date: string; liters: string; price: string; odometer: string; fillStatus: string };
export type State = EditorState<FuelEntry, Input>;
export type Action = EditorAction<FuelEntry, Input>;

export function reduce(state: State, action: Action): State {
  return reduceEditor(state, action);
}
