import { FastifyInstance } from 'fastify';
import { HttpStatus } from '../../platform/http/statusCodes';

export async function registerHealthRoutes(app: FastifyInstance) {
    app.get('/health', async () => ({
        status: HttpStatus.OK,
        service: 'drivecost-backend',
        offlineFirst: true,
        timestamp: new Date().toISOString(),
    }));
}
