import { AuthRoute, decodeProblemDetails, SyncOperation, SyncRoute, SyncRouteByEntity } from '../../domain/sync';
import type {
    ProblemDetails,
    SyncEntityType,
    SyncOperationByEntity,
    SyncPayloadByOperation,
} from '../../domain/sync';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 10_000;
const HTTP_METHOD = { Get: 'GET', Post: 'POST', Delete: 'DELETE' } as const;
const JSON_CONTENT_TYPE = 'application/json';
const SYNC_NOT_CONFIGURED_MESSAGE = 'Sync is not configured.';
let accessToken: string | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;

export class SyncApiError extends Error {
    readonly problem: ProblemDetails | null;
    readonly status: number;

    constructor(status: number, problem: ProblemDetails | null) {
        super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}.`);
        this.name = 'SyncApiError';
        this.status = status;
        this.problem = problem;
    }
}

async function requestJson(path: string, method: (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD], payload?: unknown, retried = false) {
    if (!API_BASE_URL) {
        throw new Error(SYNC_NOT_CONFIGURED_MESSAGE);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: {
                ...(payload === undefined ? {} : { 'Content-Type': JSON_CONTENT_TYPE }),
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }

    const responseBody = await response.json().catch(() => undefined);
    if (!response.ok) {
        if (response.status === 401 && !retried && refreshHandler && await refreshHandler()) {
            return requestJson(path, method, payload, true);
        }
        throw new SyncApiError(response.status, decodeProblemDetails(responseBody));
    }
    return responseBody;
}

function isSessionResponse(value: unknown): value is { accessToken: string; refreshToken: string; accessTokenExpiresAt: string; user: { id: string; mode: 'guest' | 'registered' } } {
    return Boolean(
        value &&
        typeof value === 'object' &&
        'accessToken' in value &&
        typeof (value as { accessToken?: unknown }).accessToken === 'string' &&
        typeof (value as { refreshToken?: unknown }).refreshToken === 'string' &&
        typeof (value as { accessTokenExpiresAt?: unknown }).accessTokenExpiresAt === 'string',
    );
}

export const apiClient = {
    isConfigured: Boolean(API_BASE_URL),
    hasSession: () => Boolean(accessToken),
    setAccessToken: (token: string | null) => {
        accessToken = token;
    },
    setRefreshHandler: (handler: (() => Promise<boolean>) | null) => { refreshHandler = handler; },
    refresh: async (refreshToken: string) => {
        const response = await requestJson(AuthRoute.Refresh, HTTP_METHOD.Post, { refreshToken }, true);
        if (!isSessionResponse(response)) throw new Error('The backend returned an invalid session response.');
        return response;
    },
    register: async (email: string, password: string) => {
        const response = await requestJson(AuthRoute.Register, HTTP_METHOD.Post, { email, password }, true);
        if (!isSessionResponse(response)) throw new Error('The backend returned an invalid session response.');
        return response;
    },
    login: async (email: string, password: string) => {
        const response = await requestJson(AuthRoute.Login, HTTP_METHOD.Post, { email, password }, true);
        if (!isSessionResponse(response)) throw new Error('The backend returned an invalid session response.');
        return response;
    },
    upgrade: async (email: string, password: string) => {
        const response = await requestJson(AuthRoute.Upgrade, HTTP_METHOD.Post, { email, password });
        if (!isSessionResponse(response)) throw new Error('The backend returned an invalid session response.');
        return response;
    },
    logout: async (refreshToken: string) => {
        try { await requestJson(AuthRoute.Logout, HTTP_METHOD.Post, { refreshToken }, true); } catch { /* Best-effort cleanup only. */ }
    },
    sync: <EntityType extends SyncEntityType, Operation extends SyncOperationByEntity[EntityType]>(
        entityType: EntityType,
        operation: Operation,
        payload: SyncPayloadByOperation<EntityType, Operation>,
    ) =>
        operation === SyncOperation.Delete
            ? requestJson(`${SyncRouteByEntity[entityType]}/${encodeURIComponent(payload.clientId)}`, HTTP_METHOD.Delete)
            : requestJson(SyncRouteByEntity[entityType], HTTP_METHOD.Post, payload),
    pullChanges: (after: number) => requestJson(`${SyncRoute.Changes}?after=${after}`, HTTP_METHOD.Get),
};
