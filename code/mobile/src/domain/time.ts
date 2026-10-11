/** Milliseconds since the Unix epoch, distinct from an elapsed duration. */
export type Instant = number & { readonly __brand: 'Instant' };
export type Duration = number & { readonly __brand: 'Duration' };

export function instant(milliseconds: number): Instant {
  if (!Number.isFinite(milliseconds) || Number.isNaN(new Date(milliseconds).getTime())) {
    throw new Error('An instant must be a valid Unix timestamp in milliseconds.');
  }
  return milliseconds as Instant;
}

export function duration(milliseconds: number): Duration {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new Error('A duration must be finite and non-negative.');
  }
  return milliseconds as Duration;
}

export function now(): Instant {
  return instant(Date.now());
}

export function addDuration(start: Instant, elapsed: Duration): Instant {
  return instant(start + elapsed);
}
