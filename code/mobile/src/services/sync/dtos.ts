import type { SessionResponse } from '../../domain/sync';

/** Decode external JSON once; callers receive a complete session DTO. */
export function decodeSessionResponse(value: unknown): SessionResponse {
  const invalid = () => new Error('The backend returned an invalid session response.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  if (!('accessToken' in value) || typeof value.accessToken !== 'string' || !value.accessToken) throw invalid();
  if (!('refreshToken' in value) || typeof value.refreshToken !== 'string' || !value.refreshToken) throw invalid();
  if (
    !('accessTokenExpiresAt' in value) ||
    typeof value.accessTokenExpiresAt !== 'string' ||
    Number.isNaN(Date.parse(value.accessTokenExpiresAt))
  )
    throw invalid();
  if (!('user' in value) || !value.user || typeof value.user !== 'object' || Array.isArray(value.user)) throw invalid();
  const user = value.user;
  if (!('id' in user) || typeof user.id !== 'string' || !user.id) throw invalid();
  if (!('mode' in user) || (user.mode !== 'guest' && user.mode !== 'registered')) throw invalid();
  if ('email' in user && user.email !== undefined && typeof user.email !== 'string') throw invalid();
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    accessTokenExpiresAt: value.accessTokenExpiresAt,
    user: {
      id: user.id,
      mode: user.mode,
      ...('email' in user && typeof user.email === 'string' ? { email: user.email } : {}),
    },
  };
}

export function decodeAcknowledgement(_value: unknown): void {
  // A successful HTTP status acknowledges a mutation; no response data is consumed.
}
