import {
    credentialsRequestSchema,
    CredentialsRequest,
    logoutRequestSchema,
    LogoutRequest,
    refreshRequestSchema,
    RefreshRequest,
    sessionResponseSchema,
} from '@drivecost/contracts';

export const credentialsSchema = credentialsRequestSchema;
export const refreshSchema = refreshRequestSchema;
export const logoutSchema = logoutRequestSchema;
export const authResponseSchema = sessionResponseSchema;

export type CredentialsInput = CredentialsRequest;
export type RefreshInput = RefreshRequest;
export type LogoutInput = LogoutRequest;
