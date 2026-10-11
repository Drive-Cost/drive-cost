import { create } from 'zustand';
import type { MobileSession, MobileSessionState } from '../services/sync/authSession';

type AccountState = {
  session: Pick<MobileSession, 'userId' | 'mode' | 'email'> | null;
  status: MobileSessionState;
};

// UI observes account identity, never credentials.
export const useAccountStore = create<AccountState>(() => ({ session: null, status: 'local-only' }));
