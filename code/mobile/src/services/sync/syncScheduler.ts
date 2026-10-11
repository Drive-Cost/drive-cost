/** Serializes sync passes and coalesces requests made during a running pass. */
export function createSyncScheduler(run: () => Promise<void>) {
  let active: Promise<void> | null = null;
  let requested = false;

  async function drain(): Promise<void> {
    let failed = false;
    let lastError: unknown;
    do {
      requested = false;
      try {
        await run();
        failed = false;
      } catch (error) {
        failed = true;
        lastError = error;
      }
    } while (requested);
    // Clear the active pass before resolving its promise, so late requests cannot be lost.
    active = null;
    if (failed) throw lastError;
  }

  return {
    request(): Promise<void> {
      requested = true;
      if (!active) {
        active = Promise.resolve().then(drain);
      }
      return active;
    },
  };
}
