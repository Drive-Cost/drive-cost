import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { FileRepository } from "./platform/persistence/fileRepository";
import { DriveCostRepository } from "./platform/persistence/repository";
import { registerHealthRoutes } from "./modules/health/routes";
import { registerAuthRoutes } from "./modules/auth/routes";
import { registerVehicleRoutes } from "./modules/vehicles/routes";
import { registerEntryRoutes } from "./modules/entries/routes";
import { registerSyncRoutes } from "./modules/sync/routes";

interface AppOptions {
  jwtSecret: string;
  logger?: boolean;
  repository?: DriveCostRepository;
}

export async function createApp({ jwtSecret, logger = true, repository }: AppOptions) {
  const persistence = repository ?? new FileRepository();
  await persistence.initialize();

  const app = Fastify({
    logger,
  });

  await app.register(fastifyJwt, { secret: jwtSecret });
  app.decorate("authenticate", async (request) => {
    await request.jwtVerify();
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = getErrorStatusCode(error);

    if (hasValidationError(error)) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    if (statusCode === 401) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "internal_error" });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app, persistence);
  await registerVehicleRoutes(app, persistence);
  await registerEntryRoutes(app, persistence);
  await registerSyncRoutes(app, persistence);

  app.addHook("onClose", async () => persistence.close());

  return app;
}

function hasValidationError(error: unknown): error is { validation: unknown } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "validation" in error &&
      (error as { validation?: unknown }).validation,
  );
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return undefined;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}
