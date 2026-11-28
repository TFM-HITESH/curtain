import { describe, expect, it } from "vitest";
import {
  normalizeGuest,
  normalizeIds,
  normalizeLockout,
  normalizeMarks,
  normalizePin,
  normalizePrefs,
  normalizeState,
} from "./normalize";
import { SCHEMA_VERSION, createGuestState, defaultState } from "./schema";

const NOW = 1_800_000_000_000;

describe("normalizeIds", () => {
  it("keeps valid IDs in order and drops duplicates", () => {
    expect(normalizeIds(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("drops anything that isn't a usable ID", () => {
    expect(normalizeIds(["ok", "", 7, null, {}, "x".repeat(257)])).toEqual([
      "ok",
    ]);
  });

  it("accepts IDs up to 256 characters", () => {
    const id = "x".repeat(256);
    expect(normalizeIds([id])).toEqual([id]);
  });

  it("returns an empty list for non-arrays", () => {
    expect(normalizeIds("abc")).toEqual([]);
    expect(normalizeIds(undefined)).toEqual([]);
  });
});

describe("normalizeGuest", () => {
  it("treats a missing record as Guest mode off", () => {
    expect(normalizeGuest(undefined, NOW)).toBeNull();
    expect(normalizeGuest(null, NOW)).toBeNull();
  });

  it("keeps a valid session", () => {
    const guest = {
      startedAt: 1_700_000_000_000,
      skewMs: -1500,
      session: {
        chatgpt: {
          chats: ["c1"],
          projects: ["p1"],
          items: ["i1"],
          revealed: ["r1"],
        },
        claude: { chats: [], projects: [], items: [], revealed: [] },
        gemini: { chats: ["g1"], projects: [], items: [], revealed: [] },
      },
    };
    expect(normalizeGuest(guest, NOW)).toEqual(guest);
  });

  it("fills in missing sites and sets", () => {
    const guest = normalizeGuest(
      { startedAt: 1_700_000_000_000, session: { chatgpt: { chats: ["c1"] } } },
      NOW,
    );
    expect(guest?.session.chatgpt).toEqual({
      chats: ["c1"],
      projects: [],
      items: [],
      revealed: [],
    });
    expect(guest?.session.gemini.chats).toEqual([]);
  });

  it("treats an unusable clock skew as not measured", () => {
    expect(
      normalizeGuest({ startedAt: 1, skewMs: "x" }, NOW)?.skewMs,
    ).toBeNull();
    expect(
      normalizeGuest({ startedAt: 1, skewMs: Number.NaN }, NOW)?.skewMs,
    ).toBeNull();
  });

  it("keeps Guest mode on with an empty session when the record is damaged", () => {
    for (const damaged of [
      "on",
      42,
      [],
      {},
      { startedAt: -5 },
      { startedAt: "soon" },
    ]) {
      expect(normalizeGuest(damaged, NOW)).toEqual(createGuestState(NOW));
    }
  });
});

describe("normalizeMarks", () => {
  it("keeps valid marks per site", () => {
    expect(
      normalizeMarks({ chatgpt: ["a"], claude: ["b", "b"], gemini: [] }),
    ).toEqual({
      chatgpt: ["a"],
      claude: ["b"],
      gemini: [],
    });
  });

  it("ignores unknown sites and fills missing ones", () => {
    expect(normalizeMarks({ chatgpt: ["a"], other: ["z"] })).toEqual({
      chatgpt: ["a"],
      claude: [],
      gemini: [],
    });
  });

  it("returns empty marks for anything else", () => {
    expect(normalizeMarks("marks")).toEqual({
      chatgpt: [],
      claude: [],
      gemini: [],
    });
  });
});

describe("normalizePin", () => {
  const pin = {
    algo: "PBKDF2-SHA256",
    iterations: 600_000,
    salt: "c2FsdA==",
    hash: "aGFzaA==",
  };

  it("keeps a valid record", () => {
    expect(normalizePin(pin)).toEqual(pin);
  });

  it("drops extra fields", () => {
    expect(normalizePin({ ...pin, pin: "1234" })).toEqual(pin);
  });

  it("drops a record it could never verify", () => {
    expect(normalizePin(null)).toBeNull();
    expect(normalizePin({ ...pin, algo: "MD5" })).toBeNull();
    expect(normalizePin({ ...pin, iterations: 0 })).toBeNull();
    expect(normalizePin({ ...pin, iterations: 1.5 })).toBeNull();
    expect(normalizePin({ ...pin, salt: "" })).toBeNull();
    expect(normalizePin({ ...pin, salt: 1 })).toBeNull();
    expect(normalizePin({ ...pin, hash: "" })).toBeNull();
    expect(normalizePin({ ...pin, hash: null })).toBeNull();
  });
});

describe("normalizeLockout", () => {
  it("keeps a valid lockout", () => {
    expect(normalizeLockout({ failures: 3, until: NOW })).toEqual({
      failures: 3,
      until: NOW,
    });
  });

  it("resets invalid values", () => {
    expect(normalizeLockout({ failures: -1, until: "later" })).toEqual({
      failures: 0,
      until: 0,
    });
    expect(normalizeLockout(undefined)).toEqual({ failures: 0, until: 0 });
  });
});

describe("normalizePrefs", () => {
  it("only accepts a real true for onboarded", () => {
    expect(normalizePrefs({ onboarded: true })).toEqual({ onboarded: true });
    expect(normalizePrefs({ onboarded: "yes" })).toEqual({ onboarded: false });
    expect(normalizePrefs(null)).toEqual({ onboarded: false });
  });
});

describe("normalizeState", () => {
  it("turns an empty store into the default state", () => {
    expect(normalizeState({}, NOW)).toEqual(defaultState());
  });

  it("always reports the current schema version", () => {
    expect(normalizeState({ schema: 0 }, NOW).schema).toBe(SCHEMA_VERSION);
  });
});
