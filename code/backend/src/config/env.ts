export function getEnv() {
  const port = Number(process.env.PORT || 8787);
  const jwtSecret = process.env.JWT_SECRET;
  const persistenceDriver = process.env.PERSISTENCE_DRIVER || "file";
  const databaseUrl = process.env.DATABASE_URL;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters.");
  }

  if (persistenceDriver !== "file" && persistenceDriver !== "postgres") {
    throw new Error("PERSISTENCE_DRIVER must be either file or postgres.");
  }

  if (persistenceDriver === "postgres" && !databaseUrl) {
    throw new Error("DATABASE_URL is required when using Postgres.");
  }

  return {
    port,
    jwtSecret,
    persistenceDriver,
    databaseUrl,
  };
}
