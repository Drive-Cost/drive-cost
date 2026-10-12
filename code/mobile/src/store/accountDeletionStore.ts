import { create } from 'zustand';

export type DeletionView =
  | { tag: 'none' }
  | { tag: 'ready'; mode: 'guest' | 'registered'; email?: string }
  | { tag: 'unknown' }
  | { tag: 'needs-confirmation'; signature: string }
  | { tag: 'cleanup-pending'; message: string }
  | { tag: 'blocked'; message: string }
  | { tag: 'complete' };
export const useAccountDeletionStore = create<{ view: DeletionView }>(() => ({ view: { tag: 'none' } }));
