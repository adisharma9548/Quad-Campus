/**
 * Per-item in-flight lock to prevent concurrent like requests (B5).
 * Ensures only one like request is in flight per item (post, reel, thread).
 * Extra rapid taps while a request is in flight are safely ignored.
 */
const inFlightLocks = new Set<string>();

export async function withLikeLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T | null> {
  if (inFlightLocks.has(key)) {
    return null;
  }
  inFlightLocks.add(key);
  try {
    return await fn();
  } finally {
    inFlightLocks.delete(key);
  }
}

export function isLikeInFlight(key: string): boolean {
  return inFlightLocks.has(key);
}

export function _resetLikeLocksForTesting(): void {
  inFlightLocks.clear();
}
