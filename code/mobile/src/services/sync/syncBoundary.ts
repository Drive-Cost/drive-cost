import type { MobileSession, MobileSessionState } from './authSession';
import type { SyncOwnerBinding } from '../../database/syncStateRepository';

export type SyncBoundaryState =
  | 'local-only'
  | 'authenticated'
  | 'reauth-required'
  | 'account-mismatch'
  | 'deletion-pending'
  | 'account-unavailable';

export function resolveSyncBoundary(
  configured: boolean,
  owner: SyncOwnerBinding | null,
  session: MobileSession | null,
  sessionState: MobileSessionState
): SyncBoundaryState {
  if (sessionState === 'deletion-pending' || sessionState === 'account-unavailable') return sessionState;
  if (!configured || !owner) return 'local-only';
  if (sessionState === 'account-mismatch' || (session && session.userId !== owner.userId)) return 'account-mismatch';
  if (!session || sessionState === 'reauth-required') return 'reauth-required';
  return 'authenticated';
}
