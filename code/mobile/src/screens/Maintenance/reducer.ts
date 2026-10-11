import { reduce as reduceEditor } from '../../hooks/useEntryEditor/reducer';
import type { State as EditorState, Action as EditorAction } from '../../hooks/useEntryEditor/reducer';
import type { MaintenanceEntry } from '../../models/MaintenanceEntry';

export type Input = { date: string; type: string; description: string; cost: string; odometer: string };
export type State = EditorState<MaintenanceEntry, Input>;
export type Action = EditorAction<MaintenanceEntry, Input>;

export function reduce(state: State, action: Action): State {
  return reduceEditor(state, action);
}
