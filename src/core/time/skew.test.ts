import { describe, expect, it } from "vitest";
import {
  MAX_SKEW_MS,
  MEASURED_TOLERANCE_MS,
  UNMEASURED_TOLERANCE_MS,
  createdInSession,
  measureSkew,
} from "./skew";

const STARTED = Date.UTC(2026, 10, 28, 10, 0, 0);

describe("measureSkew", () => {
  it("returns server time minus local time", () => {
    expect(measureSkew(STARTED + 4000, STARTED)).toBe(4000);
    expect(measureSkew(STARTED - 2500, STARTED)).toBe(-2500);
  });

  it("refuses a difference too large to be a clock error", () => {
    expect(measureSkew(STARTED + MAX_SKEW_MS + 1, STARTED)).toBeNull();
    expect(measureSkew(STARTED - MAX_SKEW_MS - 1, STARTED)).toBeNull();
    expect(measureSkew(STARTED + MAX_SKEW_MS, STARTED)).toBe(MAX_SKEW_MS);
  });
});

describe("createdInSession", () => {
  describe("before the clock difference is measured", () => {
    it("accepts items created after the start", () => {
      expect(createdInSession(STARTED + 1, STARTED, null)).toBe(true);
    });

    it("allows a small early margin for clock drift", () => {
      expect(
        createdInSession(STARTED - UNMEASURED_TOLERANCE_MS, STARTED, null),
      ).toBe(true);
      expect(
        createdInSession(STARTED - UNMEASURED_TOLERANCE_MS - 1, STARTED, null),
      ).toBe(false);
    });

    it("rejects items created well before the start", () => {
      expect(createdInSession(STARTED - 60_000, STARTED, null)).toBe(false);
    });
  });

  describe("once the clock difference is measured", () => {
    it("shifts the start by the difference", () => {
      // The server runs 30 seconds ahead of the local clock.
      const skew = 30_000;
      expect(createdInSession(STARTED + 25_000, STARTED, skew)).toBe(false);
      expect(createdInSession(STARTED + 30_000, STARTED, skew)).toBe(true);
    });

    it("uses the smaller margin", () => {
      expect(
        createdInSession(STARTED - MEASURED_TOLERANCE_MS, STARTED, 0),
      ).toBe(true);
      expect(
        createdInSession(STARTED - MEASURED_TOLERANCE_MS - 1, STARTED, 0),
      ).toBe(false);
    });

    it("handles a server clock that runs behind", () => {
      const skew = -45_000;
      expect(createdInSession(STARTED - 44_000, STARTED, skew)).toBe(true);
      expect(createdInSession(STARTED - 50_000, STARTED, skew)).toBe(false);
    });
  });
});
