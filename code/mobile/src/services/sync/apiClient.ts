import type { SessionResponse, PullResponse } from '../../domain/sync';
import { decodeSessionResponse, decodeAcknowledgement } from './dtos';
import {
  AuthRoute,
  decodeProblemDetails,
  decodePullResponse,
  SyncOperation,
  SyncRoute,
  SyncRouteByEntity,
} from '../../domain/sync';
import type { ProblemDetails, SyncEntityType, SyncOperationByEntity, SyncPayloadByOperation } from '../../domain/sync';

const configuredApiUrl: unknown = process.env.EXPO_PUBLIC_API_BASE_URL;
const API_BASE_URL = typeof configuredApiUrl === 'string' ? configuredApiUrl.replace(/\/$/, '') : undefined;

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

async function requestJson<Output>(
  path: string,
  method: (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD],
  decode: (value: unknown) => Output,
  payload?: object,
  retried = false
): Promise<Output> {
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

  const responseBody: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401 && !retried && refreshHandler && (await refreshHandler())) {
      return requestJson(path, method, decode, payload, true);
    }
    throw new SyncApiError(response.status, decodeProblemDetails(responseBody));
  }
  return decode(responseBody);
}

export const apiClient = {
  isConfigured: Boolean(API_BASE_URL),
  hasSession: () => Boolean(accessToken),
  setAccessToken: (token: string | null) => {
    accessToken = token;
  },
  setRefreshHandler: (handler: (() => Promise<boolean>) | null) => {
    refreshHandler = handler;
  },
  refresh: (refreshToken: string): Promise<SessionResponse> =>
    requestJson(AuthRoute.Refresh, HTTP_METHOD.Post, decodeSessionResponse, { refreshToken }, true),
  register: (email: string, password: string): Promise<SessionResponse> =>
    requestJson(AuthRoute.Register, HTTP_METHOD.Post, decodeSessionResponse, { email, password }, true),
  login: (email: string, password: string): Promise<SessionResponse> =>
    requestJson(AuthRoute.Login, HTTP_METHOD.Post, decodeSessionResponse, { email, password }, true),
  upgrade: (email: string, password: string): Promise<SessionResponse> =>
    requestJson(AuthRoute.Upgrade, HTTP_METHOD.Post, decodeSessionResponse, { email, password }),
  logout: async (refreshToken: string): Promise<void> => {
    try {
      await requestJson(AuthRoute.Logout, HTTP_METHOD.Post, decodeAcknowledgement, { refreshToken }, true);
    } catch {
      /* Best-effort cleanup only. */
    }
  },
  sync: <EntityType extends SyncEntityType, Operation extends SyncOperationByEntity[EntityType]>(
    entityType: EntityType,
    operation: Operation,
    payload: SyncPayloadByOperation<EntityType, Operation>
  ): Promise<void> =>
    operation === SyncOperation.Delete
      ? requestJson(
          `${SyncRouteByEntity[entityType]}/${encodeURIComponent(payload.clientId)}`,
          HTTP_METHOD.Delete,
          decodeAcknowledgement
        )
      : requestJson(SyncRouteByEntity[entityType], HTTP_METHOD.Post, decodeAcknowledgement, payload),
  pullChanges: (after: number): Promise<PullResponse> =>
    requestJson(`${SyncRoute.Changes}?after=${after}`, HTTP_METHOD.Get, value => decodePullResponse(value, after)),
};
