import { describe, expect, it } from "vitest";
import { createGuestState, emptyMarks, type GuestState } from "../state/schema";
import {
  visibilityRules,
  type ChatItem,
  type VisibilityItem,
} from "./visibility";

const STARTED = Date.UTC(2026, 10, 28, 10, 0, 0);
const AFTER = STARTED + 60_000;
const BEFORE = STARTED - 60 * 60_000;

const base = createGuestState(STARTED);
const guest: GuestState = {
  ...base,
  session: {
    ...base.session,
    chatgpt: {
      chats: ["open-at-start", "created"],
      projects: ["new-project"],
      items: ["new-file"],
      revealed: ["revealed"],
    },
  },
};
const marks = {
  ...emptyMarks(),
  chatgpt: ["marked"],
  claude: ["claude-marked"],
};

const chat = (id: string, createdAt: number | null = null): ChatItem => ({
  kind: "chat",
  id,
  createdAt,
});

const project = (
  id: string,
  chats: readonly ChatItem[] = [],
  createdAt: number | null = null,
): VisibilityItem => ({ kind: "project", id, createdAt, chats });

const other = (
  id: string,
  createdAt: number | null = null,
): VisibilityItem => ({
  kind: "item",
  id,
  createdAt,
});

describe("visibilityRules", () => {
  describe("with Guest mode off", () => {
    const isVisible = visibilityRules({ guest: null, marks }, "chatgpt");

    it.each([
      ["an old chat", chat("old", BEFORE)],
      ["a chat with no known time", chat("unknown")],
      ["an old project", project("old-project", [chat("old")], BEFORE)],
      ["an old file", other("old-file", BEFORE)],
    ])("shows %s", (_, item) => {
      expect(isVisible(item)).toBe(true);
    });
  });

  describe("with Guest mode on", () => {
    const isVisible = visibilityRules({ guest, marks }, "chatgpt");

    it.each<[string, VisibilityItem, boolean]>([
      // Chats
      [
        "the chat that was open when Guest mode started",
        chat("open-at-start"),
        true,
      ],
      ["a chat seen being created", chat("created"), true],
      ["a chat whose ID says it's new", chat("by-time", AFTER), true],
      ["a chat revealed with the PIN", chat("revealed"), true],
      ["a marked chat", chat("marked"), true],
      ["an old chat", chat("old", BEFORE), false],
      ["a chat with no known time", chat("unknown"), false],
      ["a chat marked only on another site", chat("claude-marked"), false],

      // Projects
      ["a project created during the session", project("new-project"), true],
      ["a project whose ID says it's new", project("p", [], AFTER), true],
      [
        "a project holding a session chat",
        project("p", [chat("created")]),
        true,
      ],
      ["a project holding a marked chat", project("p", [chat("marked")]), true],
      ["a project holding a new chat", project("p", [chat("x", AFTER)]), true],
      [
        "a project holding only old chats",
        project("p", [chat("a", BEFORE), chat("b")], BEFORE),
        false,
      ],
      ["an old empty project", project("p", [], BEFORE), false],
      ["a project with nothing known about it", project("p"), false],

      // Other items
      ["a file created during the session", other("new-file"), true],
      ["a file whose data says it's new", other("f", AFTER), true],
      ["an old file", other("f", BEFORE), false],
      ["a file with no known time", other("f"), false],
      ["a file sharing an ID with a marked chat", other("marked"), false],
    ])("%s → %s", (_, item, expected) => {
      expect(isVisible(item)).toBe(expected);
    });
  });

  it("keeps each site's session separate", () => {
    const claude = visibilityRules({ guest, marks }, "claude");
    expect(claude(chat("open-at-start"))).toBe(false);
    expect(claude(chat("claude-marked"))).toBe(true);
  });

  it("uses the measured clock difference", () => {
    // The server clock runs 5 minutes ahead of the local one.
    const skewed = { ...guest, skewMs: 5 * 60_000 };
    const isVisible = visibilityRules({ guest: skewed, marks }, "chatgpt");
    expect(isVisible(chat("x", STARTED + 60_000))).toBe(false);
    expect(isVisible(chat("x", STARTED + 5 * 60_000))).toBe(true);
  });
});
