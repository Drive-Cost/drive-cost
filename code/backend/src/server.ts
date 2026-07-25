import { createApp } from "./app";
import { getEnv } from "./config/env";

async function start() {
  const env = getEnv();
  const app = await createApp({ jwtSecret: env.jwtSecret });

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
