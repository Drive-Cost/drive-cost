import { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
    app.get('/health', async () => ({
        status: 'ok',
        service: 'drivecost-backend',
        offlineFirst: true,
        timestamp: new Date().toISOString(),
    }));
}
