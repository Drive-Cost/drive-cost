import { reduce as reduceEditor } from '../../hooks/useEntryEditor/reducer';
import type { State as EditorState, Action as EditorAction } from '../../hooks/useEntryEditor/reducer';
import type { ExpenseEntry } from '../../models/ExpenseEntry';

export type Input = { category: string; date: string; totalPaid: string; odometer: string; description: string };
export type State = EditorState<ExpenseEntry, Input>;
export type Action = EditorAction<ExpenseEntry, Input>;

export function reduce(state: State, action: Action): State {
  return reduceEditor(state, action);
}
