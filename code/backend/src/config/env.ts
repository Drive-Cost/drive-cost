export function getEnv() {
  const port = Number(process.env.PORT || 8787);
  const jwtSecret = process.env.JWT_SECRET;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters.");
  }

  return {
    port,
    jwtSecret,
  };
}
