const INITIAL_RETRY_DELAY_MS = 30_000;
const MAXIMUM_RETRY_DELAY_MS = 15 * 60 * 1_000;

export function nextRetryAt(retryCount: number, now = Date.now()): string {
    const exponent = Math.max(0, retryCount - 1);
    const delay = Math.min(INITIAL_RETRY_DELAY_MS * 2 ** exponent, MAXIMUM_RETRY_DELAY_MS);
    return new Date(now + delay).toISOString();
}
