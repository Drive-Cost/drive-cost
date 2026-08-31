import { decodeProblemDetails, SyncRoute, SyncRouteByEntity } from '../../domain/sync';
import type { ProblemDetails, SyncEntityType, SyncPayloadByEntity } from '../../domain/sync';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 10_000;
const HTTP_METHOD = { Get: 'GET', Post: 'POST' } as const;
const JSON_CONTENT_TYPE = 'application/json';
const SYNC_NOT_CONFIGURED_MESSAGE = 'Sync is not configured.';
let accessToken: string | null = null;

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

async function requestJson(path: string, method: (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD], payload?: unknown) {
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
        throw new SyncApiError(response.status, decodeProblemDetails(responseBody));
    }
    return responseBody;
}

function isGuestSessionResponse(value: unknown): value is { accessToken: string } {
    return Boolean(
        value &&
        typeof value === 'object' &&
        'accessToken' in value &&
        typeof (value as { accessToken?: unknown }).accessToken === 'string',
    );
}

export const apiClient = {
    isConfigured: Boolean(API_BASE_URL),
    hasSession: () => Boolean(accessToken),
    setAccessToken: (token: string | null) => {
        accessToken = token;
    },
    createGuestSession: async () => {
        const response = await requestJson(SyncRoute.GuestSession, HTTP_METHOD.Post, {});

        if (!isGuestSessionResponse(response)) {
            throw new Error('The backend returned an invalid guest session.');
        }

        return response;
    },
    sync: <EntityType extends SyncEntityType>(entityType: EntityType, payload: SyncPayloadByEntity[EntityType]) =>
        requestJson(SyncRouteByEntity[entityType], HTTP_METHOD.Post, payload),
    pullChanges: (after: number) => requestJson(`${SyncRoute.Changes}?after=${after}`, HTTP_METHOD.Get),
};
