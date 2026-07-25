import { createApp } from "./app";
import { getEnv } from "./config/env";
import { FileRepository } from "./platform/persistence/fileRepository";
import { PostgresRepository } from "./platform/persistence/postgresRepository";

async function start() {
  const env = getEnv();
  const repository =
    env.persistenceDriver === "postgres"
      ? new PostgresRepository(env.databaseUrl!)
      : new FileRepository();
  const app = await createApp({ jwtSecret: env.jwtSecret, repository });

  try {
    await app.listen({
      port: env.port,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
