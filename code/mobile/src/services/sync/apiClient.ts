import { AccountRoute, decodeAccountDeletionStatus } from '@drivecost/contracts';
import type { AccountDeletionRequest, AccountDeletionStatus } from '@drivecost/contracts';
import type { SessionResponse, PullResponse } from '../../domain/sync';
import { decodeSessionResponse, decodeAcknowledgement } from './dtos';
import {
  AdoptionProtocol,
  AuthRoute,
  decodeProblemDetails,
  decodePullResponse,
  SyncOperation,
  SyncRoute,
  SyncRouteByEntity,
} from '../../domain/sync';
import type {
  ProblemDetails,
  SyncEntityType,
  SyncOperationByEntity,
  SyncPayloadByOperation,
  SyncPayloadByEntity,
} from '../../domain/sync';

const configuredApiUrl: unknown = process.env.EXPO_PUBLIC_API_BASE_URL;
const API_BASE_URL = typeof configuredApiUrl === 'string' ? configuredApiUrl.replace(/\/$/, '') : undefined;

const REQUEST_TIMEOUT_MS = 10_000;
const HTTP_METHOD = { Get: 'GET', Post: 'POST', Delete: 'DELETE' } as const;
const JSON_CONTENT_TYPE = 'application/json';
const SYNC_NOT_CONFIGURED_MESSAGE = 'Sync is not configured.';
let accessToken: string | null = null;
let unavailableHandler: ((token: string) => Promise<void>) | null = null;
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
  retried = false,
  options: { accessToken?: string; anonymous?: boolean; adoption?: boolean; requireAdoptionSupport?: boolean } = {}
): Promise<Output> {
  if (!API_BASE_URL) {
    throw new Error(SYNC_NOT_CONFIGURED_MESSAGE);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const requestToken = options.anonymous ? null : (options.accessToken ?? accessToken);
  let response: Response;
  let responseBody: unknown;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(payload === undefined ? {} : { 'Content-Type': JSON_CONTENT_TYPE }),
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
        ...(options.adoption ? { [AdoptionProtocol.header]: AdoptionProtocol.version } : {}),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: controller.signal,
    });
    responseBody = await response.json().catch(() => undefined);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const problem = decodeProblemDetails(responseBody);
    if (
      response.status === 410 &&
      problem?.type === 'https://drivecost.app/problems/account-unavailable' &&
      requestToken &&
      !options.anonymous
    ) {
      await unavailableHandler?.(requestToken);
    }
    if (response.status === 401 && !retried && refreshHandler && (await refreshHandler())) {
      return requestJson(path, method, decode, payload, true, options);
    }
    throw new SyncApiError(response.status, decodeProblemDetails(responseBody));
  }
  if (options.requireAdoptionSupport && response.headers.get(AdoptionProtocol.header) !== AdoptionProtocol.version) {
    throw new Error('Adding device data is not available yet. Your device data is safe.');
  }
  return decode(responseBody);
}

export const apiClient = {
  isConfigured: Boolean(API_BASE_URL),
  setUnavailableHandler: (handler: ((token: string) => Promise<void>) | null) => {
    unavailableHandler = handler;
  },
  deleteAccount: (input: AccountDeletionRequest, token: string): Promise<AccountDeletionStatus> =>
    requestJson(AccountRoute.Deletion, HTTP_METHOD.Post, decodeAccountDeletionStatus, input, true, {
      accessToken: token,
    }),
  deletionStatus: (operationSecret: string): Promise<AccountDeletionStatus> =>
    requestJson(AccountRoute.DeletionStatus, HTTP_METHOD.Post, decodeAccountDeletionStatus, { operationSecret }, true, {
      anonymous: true,
    }),
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
  pullAccountChanges: (
    after: number,
    accountAccessToken: string,
    requireAdoptionSupport = false
  ): Promise<PullResponse> =>
    requestJson(
      `${SyncRoute.Changes}?after=${after}`,
      HTTP_METHOD.Get,
      value => decodePullResponse(value, after),
      undefined,
      true,
      { accessToken: accountAccessToken, requireAdoptionSupport }
    ),
  createAdoptedEntity: <Entity extends SyncEntityType>(
    entity: Entity,
    payload: SyncPayloadByEntity[Entity]
  ): Promise<void> =>
    requestJson(
      `${SyncRouteByEntity[entity]}${AdoptionProtocol.pathSuffix}`,
      HTTP_METHOD.Post,
      decodeAcknowledgement,
      payload,
      false,
      { adoption: true }
    ),
  pullChanges: (after: number): Promise<PullResponse> =>
    requestJson(`${SyncRoute.Changes}?after=${after}`, HTTP_METHOD.Get, value => decodePullResponse(value, after)),
};
