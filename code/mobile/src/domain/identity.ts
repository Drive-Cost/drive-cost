/**
 * Generates an opaque identifier owned by this device. It is persisted with the
 * local entity and is the idempotency key used by the backend during sync.
 */
export function createClientId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
