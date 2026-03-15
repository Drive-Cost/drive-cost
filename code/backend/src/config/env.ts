export function getEnv() {
  return {
    port: Number(process.env.PORT || 8787),
  };
}
