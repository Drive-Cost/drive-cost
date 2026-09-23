import crypto from 'node:crypto';
import { createId } from '../../lib/ids';
import { AuthSessionRecord } from '../../types/domain';

export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
export const REFRESH_SESSION_INACTIVITY_DAYS = 30;

export interface RefreshCredential {
    sessionId: string;
    refreshTokenHash: string;
}

export interface NewSession {
    session: AuthSessionRecord;
    refreshToken: string;
}

export function createSession(userId: string, now = new Date()): NewSession {
    const sessionId = createId('session');
    const secret = crypto.randomBytes(32).toString('base64url');
    const issuedAt = now.toISOString();
    const expiresAt = addRefreshInactivityLifetime(now).toISOString();
    return {
        session: {
            id: sessionId,
            userId,
            refreshTokenHash: hashRefreshSecret(secret),
            createdAt: issuedAt,
            lastUsedAt: issuedAt,
            expiresAt,
        },
        refreshToken: `${sessionId}.${secret}`,
    };
}

export function createRotatedRefreshCredential(
    sessionId: string,
    now = new Date(),
): { refreshToken: string; refreshTokenHash: string; lastUsedAt: string; expiresAt: string } {
    const secret = crypto.randomBytes(32).toString('base64url');
    return {
        refreshToken: `${sessionId}.${secret}`,
        refreshTokenHash: hashRefreshSecret(secret),
        lastUsedAt: now.toISOString(),
        expiresAt: addRefreshInactivityLifetime(now).toISOString(),
    };
}

export function parseRefreshCredential(value: string): RefreshCredential | null {
    const parts = value.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return { sessionId: parts[0], refreshTokenHash: hashRefreshSecret(parts[1]) };
}

export function accessTokenExpiresAt(now = new Date()): string {
    return new Date(now.getTime() + ACCESS_TOKEN_LIFETIME_SECONDS * 1000).toISOString();
}

function addRefreshInactivityLifetime(now: Date): Date {
    return new Date(now.getTime() + REFRESH_SESSION_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);
}

function hashRefreshSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
}
