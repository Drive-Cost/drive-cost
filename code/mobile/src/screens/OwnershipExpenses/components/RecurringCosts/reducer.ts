import { reduce as reduceEditor } from '../../../../hooks/useEntryEditor/reducer';
import type { State as EditorState, Action as EditorAction } from '../../../../hooks/useEntryEditor/reducer';
import type { RecurringExpense } from '../../../../models/RecurringExpense';

export type Input = {
  category: string;
  amount: string;
  periodMonths: string;
  startDate: string;
  nextDueDate: string;
  description: string;
};
export type State = EditorState<RecurringExpense, Input>;
export type Action = EditorAction<RecurringExpense, Input>;
export function reduce(state: State, action: Action): State {
  return reduceEditor(state, action);
}
