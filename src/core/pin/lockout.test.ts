import { describe, expect, it } from "vitest";
import {
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  NO_LOCKOUT,
  isLockedOut,
  lockoutRemaining,
  recordFailure,
  recordSuccess,
} from "./lockout";

const NOW = Date.UTC(2026, 10, 28, 12, 0, 0);

function fail(times: number, now = NOW) {
  let lockout = NO_LOCKOUT;
  for (let i = 0; i < times; i++) lockout = recordFailure(lockout, now);
  return lockout;
}

describe("lockout", () => {
  it("allows five tries before blocking", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(isLockedOut(fail(4), NOW)).toBe(false);
    expect(fail(4).failures).toBe(4);
    expect(isLockedOut(fail(5), NOW)).toBe(true);
  });

  it("blocks for 30 seconds", () => {
    expect(LOCKOUT_MS).toBe(30_000);
    const lockout = fail(5);
    expect(lockoutRemaining(lockout, NOW)).toBe(30_000);
    expect(lockoutRemaining(lockout, NOW + 29_999)).toBe(1);
    expect(isLockedOut(lockout, NOW + 30_000)).toBe(false);
    expect(lockoutRemaining(lockout, NOW + 60_000)).toBe(0);
  });

  it("starts counting again after a block ends", () => {
    const blocked = fail(5);
    expect(blocked.failures).toBe(0);
    const later = NOW + LOCKOUT_MS;
    let lockout = blocked;
    for (let i = 0; i < 4; i++) lockout = recordFailure(lockout, later);
    expect(isLockedOut(lockout, later)).toBe(false);
    lockout = recordFailure(lockout, later);
    expect(isLockedOut(lockout, later)).toBe(true);
    expect(lockoutRemaining(lockout, later)).toBe(LOCKOUT_MS);
  });

  it("clears everything after a correct PIN", () => {
    expect(recordSuccess()).toEqual({ failures: 0, until: 0 });
  });

  it("isn't locked out by default", () => {
    expect(isLockedOut(NO_LOCKOUT, NOW)).toBe(false);
  });
});
