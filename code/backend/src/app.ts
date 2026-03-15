import Fastify from "fastify";
import { ensureDatabase } from "./lib/fileDatabase";
import { registerHealthRoutes } from "./modules/health/routes";
import { registerAuthRoutes } from "./modules/auth/routes";
import { registerVehicleRoutes } from "./modules/vehicles/routes";
import { registerEntryRoutes } from "./modules/entries/routes";

export async function createApp() {
  ensureDatabase();

  const app = Fastify({
    logger: true,
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerVehicleRoutes(app);
  await registerEntryRoutes(app);

  return app;
}
