import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  SITE_IDS,
  STORAGE_KEYS,
  createGuestState,
  defaultState,
  emptyMarks,
} from "./schema";

describe("defaultState", () => {
  it("starts with Guest mode off, no PIN and no marks", () => {
    expect(defaultState()).toEqual({
      guest: null,
      marks: { chatgpt: [], claude: [], gemini: [] },
      pin: null,
      lockout: { failures: 0, until: 0 },
      prefs: { onboarded: false },
      schema: SCHEMA_VERSION,
    });
  });

  it("has a value for every storage key", () => {
    expect(Object.keys(defaultState()).sort()).toEqual(
      [...STORAGE_KEYS].sort(),
    );
  });

  it("returns independent objects", () => {
    const a = defaultState();
    const b = defaultState();
    expect(a.marks).not.toBe(b.marks);
    expect(a.marks.chatgpt).not.toBe(b.marks.chatgpt);
  });
});

describe("createGuestState", () => {
  it("records the start time with empty sets for every site", () => {
    const guest = createGuestState(1_800_000_000_000);
    expect(guest.startedAt).toBe(1_800_000_000_000);
    expect(guest.skewMs).toBe(0);
    expect(Object.keys(guest.session)).toEqual([...SITE_IDS]);
    for (const site of SITE_IDS) {
      expect(guest.session[site]).toEqual({
        chats: [],
        projects: [],
        items: [],
        revealed: [],
      });
    }
  });
});

describe("emptyMarks", () => {
  it("has an empty list for every site", () => {
    expect(emptyMarks()).toEqual({ chatgpt: [], claude: [], gemini: [] });
  });
});
