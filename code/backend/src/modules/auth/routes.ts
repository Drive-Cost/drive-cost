import { FastifyInstance } from 'fastify';
import { AuthRoute, SafeUser, SessionResponse } from '@drivecost/contracts';
import { createId } from '../../lib/ids';
import { DriveCostRepository } from '../../platform/persistence/repository';
import {
    CredentialsInput,
    authResponseSchema,
    credentialsSchema,
    LogoutInput,
    logoutSchema,
    RefreshInput,
    refreshSchema,
} from './schemas';
import { hashPassword, verifyPassword } from './passwords';
import {
    accessTokenExpiresAt,
    createRotatedRefreshCredential,
    createSession,
    parseRefreshCredential,
} from './sessions';
import { Problems } from '../../platform/http/problemDetails';
import { UserRecord } from '../../types/domain';
import { HttpStatus } from '../../platform/http/statusCodes';

const publicAuthRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
const refreshRateLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

function toSessionResponse(
    app: FastifyInstance,
    user: UserRecord,
    sessionId: string,
    refreshToken: string,
): SessionResponse {
    const safeUser: SafeUser = { id: user.id, mode: user.mode, ...(user.email ? { email: user.email } : {}) };
    return {
        accessToken: app.jwt.sign({ sub: user.id, mode: user.mode, sid: sessionId }),
        refreshToken,
        accessTokenExpiresAt: accessTokenExpiresAt(),
        user: safeUser,
    };
}

export async function registerAuthRoutes(app: FastifyInstance, repository: DriveCostRepository) {
    app.post(
        AuthRoute.Guest,
        { ...publicAuthRateLimit, schema: { response: { [HttpStatus.CREATED]: authResponseSchema } } },
        async (_request, reply) => {
            const user = { id: createId('user'), mode: 'guest' as const, createdAt: new Date().toISOString() };
            const newSession = createSession(user.id);
            await repository.createUserWithSession(user, newSession.session);
            reply.code(HttpStatus.CREATED);
            return toSessionResponse(app, user, newSession.session.id, newSession.refreshToken);
        },
    );

    app.post<{ Body: CredentialsInput }>(
        AuthRoute.Register,
        {
            ...publicAuthRateLimit,
            schema: { body: credentialsSchema, response: { [HttpStatus.CREATED]: authResponseSchema } },
        },
        async (request, reply) => {
            const email = request.body.email.trim().toLowerCase();
            if (await repository.findUserByEmail(email)) throw Problems.emailAlreadyRegistered();

            const user = {
                id: createId('user'),
                mode: 'registered' as const,
                email,
                passwordHash: await hashPassword(request.body.password),
                createdAt: new Date().toISOString(),
            };
            const newSession = createSession(user.id);
            try {
                await repository.createUserWithSession(user, newSession.session);
            } catch (error) {
                if (isDuplicateEmailError(error)) throw Problems.emailAlreadyRegistered();
                throw error;
            }
            reply.code(HttpStatus.CREATED);
            return toSessionResponse(app, user, newSession.session.id, newSession.refreshToken);
        },
    );

    app.post<{ Body: CredentialsInput }>(
        AuthRoute.Login,
        {
            ...publicAuthRateLimit,
            schema: { body: credentialsSchema, response: { [HttpStatus.OK]: authResponseSchema } },
        },
        async (request) => {
            const email = request.body.email.trim().toLowerCase();
            const user = await repository.findUserByEmail(email);
            if (
                user?.mode !== 'registered' ||
                !user.passwordHash ||
                !(await verifyPassword(request.body.password, user.passwordHash))
            ) {
                throw Problems.invalidCredentials();
            }
            const newSession = createSession(user.id);
            await repository.createAuthSession(newSession.session);
            return toSessionResponse(app, user, newSession.session.id, newSession.refreshToken);
        },
    );

    app.post<{ Body: RefreshInput }>(
        AuthRoute.Refresh,
        { ...refreshRateLimit, schema: { body: refreshSchema, response: { [HttpStatus.OK]: authResponseSchema } } },
        async (request) => {
            const current = parseRefreshCredential(request.body.refreshToken);
            if (!current) throw Problems.unauthorized();

            const next = createRotatedRefreshCredential(current.sessionId);
            const result = await repository.rotateAuthSession(
                current.sessionId,
                current.refreshTokenHash,
                next.refreshTokenHash,
                next.lastUsedAt,
                next.expiresAt,
            );
            if (!result) throw Problems.unauthorized();
            return toSessionResponse(app, result.user, result.sessionId, next.refreshToken);
        },
    );

    app.post<{ Body: CredentialsInput }>(
        AuthRoute.Upgrade,
        {
            preHandler: [app.authenticate],
            schema: { body: credentialsSchema, response: { [HttpStatus.OK]: authResponseSchema } },
        },
        async (request) => {
            const currentUser = await repository.findUserById(request.user.sub);
            if (request.user.mode !== 'guest' || currentUser?.mode !== 'guest') {
                throw Problems.guestUpgradeUnavailable();
            }
            const email = request.body.email.trim().toLowerCase();
            const newSession = createSession(currentUser.id);
            try {
                const upgradedUser = await repository.upgradeGuestUserWithSession(
                    currentUser.id,
                    request.user.sid,
                    email,
                    await hashPassword(request.body.password),
                    newSession.session,
                );
                if (!upgradedUser) throw Problems.guestUpgradeUnavailable();
                return toSessionResponse(app, upgradedUser, newSession.session.id, newSession.refreshToken);
            } catch (error) {
                if (isDuplicateEmailError(error)) throw Problems.emailAlreadyRegistered();
                throw error;
            }
        },
    );

    app.post<{ Body: LogoutInput }>(
        AuthRoute.Logout,
        { schema: { body: logoutSchema, response: { [HttpStatus.NO_CONTENT]: { type: 'null' } } } },
        async (request, reply) => {
            const credential = parseRefreshCredential(request.body.refreshToken);
            if (credential) await repository.revokeAuthSession(credential.sessionId, credential.refreshTokenHash);
            return reply.code(HttpStatus.NO_CONTENT).send();
        },
    );
}

function isDuplicateEmailError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
