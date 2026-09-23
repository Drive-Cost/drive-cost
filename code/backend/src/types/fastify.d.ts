import '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthenticatedUser } from './domain';

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: AuthenticatedUser;
        user: AuthenticatedUser;
    }
}

declare module 'fastify' {
    interface FastifyInstance {
        authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    }
}
