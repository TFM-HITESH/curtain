import type { Lockout } from "../state/schema";

/**
 * Slowing down PIN guessing.
 *
 * After five wrong attempts in a row, attempts are blocked for 30 seconds.
 * The counter is stored, so reloading the page doesn't reset it. Once a block
 * ends, the next five attempts get the same treatment.
 */

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;

export const NO_LOCKOUT: Lockout = { failures: 0, until: 0 };

/** Milliseconds until attempts are allowed again, or 0 if they are now. */
export function lockoutRemaining(lockout: Lockout, now: number): number {
  return Math.max(0, lockout.until - now);
}

export function isLockedOut(lockout: Lockout, now: number): boolean {
  return lockoutRemaining(lockout, now) > 0;
}

/** The lockout state after a wrong attempt. */
export function recordFailure(lockout: Lockout, now: number): Lockout {
  const failures = lockout.failures + 1;
  return failures >= MAX_ATTEMPTS
    ? { failures: 0, until: now + LOCKOUT_MS }
    : { failures, until: lockout.until };
}

/** The lockout state after a correct attempt. */
export function recordSuccess(): Lockout {
  return NO_LOCKOUT;
}
