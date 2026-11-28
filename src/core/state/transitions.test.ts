import { describe, expect, it } from "vitest";
import { createGuestState, emptyMarks } from "./schema";
import {
  addToSession,
  clearMarks,
  isSiteId,
  recordCreatedChat,
  revealChat,
  setMark,
  startSession,
} from "./transitions";

const NOW = Date.UTC(2026, 10, 28, 12, 0, 0);

describe("isSiteId", () => {
  it("accepts supported sites only", () => {
    expect(isSiteId("chatgpt")).toBe(true);
    expect(isSiteId("gemini")).toBe(true);
    expect(isSiteId("bing")).toBe(false);
    expect(isSiteId(undefined)).toBe(false);
  });
});

describe("startSession", () => {
  it("starts an empty session", () => {
    expect(startSession(NOW)).toEqual(createGuestState(NOW));
  });

  it("includes the chat that was open when Guest mode started", () => {
    const guest = startSession(NOW, { site: "claude", chatId: "open" });
    expect(guest.session.claude.chats).toEqual(["open"]);
    expect(guest.session.chatgpt.chats).toEqual([]);
  });
});

describe("addToSession", () => {
  it("adds new IDs and skips ones already there", () => {
    let guest = addToSession(createGuestState(NOW), "chatgpt", "chats", [
      "a",
      "b",
    ]);
    guest = addToSession(guest, "chatgpt", "chats", ["b", "c"]);
    expect(guest.session.chatgpt.chats).toEqual(["a", "b", "c"]);
  });

  it("keeps the same list when nothing is new", () => {
    const guest = addToSession(createGuestState(NOW), "chatgpt", "items", [
      "x",
    ]);
    const again = addToSession(guest, "chatgpt", "items", ["x"]);
    expect(again.session.chatgpt.items).toBe(guest.session.chatgpt.items);
  });

  it("only touches the given site and set", () => {
    const guest = addToSession(createGuestState(NOW), "gemini", "projects", [
      "p",
    ]);
    expect(guest.session.gemini).toEqual({
      chats: [],
      projects: ["p"],
      items: [],
      revealed: [],
    });
    expect(guest.session.claude.projects).toEqual([]);
  });
});

describe("recordCreatedChat", () => {
  it("adds the chat to the session", () => {
    const guest = recordCreatedChat(
      createGuestState(NOW),
      "claude",
      "new",
      null,
      NOW,
    );
    expect(guest.session.claude.chats).toEqual(["new"]);
    expect(guest.skewMs).toBeNull();
  });

  it("measures the clock difference from the first chat with a time", () => {
    const guest = recordCreatedChat(
      createGuestState(NOW),
      "chatgpt",
      "new",
      NOW + 3000,
      NOW,
    );
    expect(guest.skewMs).toBe(3000);
  });

  it("keeps an existing measurement", () => {
    const measured = { ...createGuestState(NOW), skewMs: 1000 };
    const guest = recordCreatedChat(
      measured,
      "chatgpt",
      "new",
      NOW + 9000,
      NOW,
    );
    expect(guest.skewMs).toBe(1000);
  });

  it("ignores a difference too large to trust", () => {
    const guest = recordCreatedChat(
      createGuestState(NOW),
      "chatgpt",
      "new",
      NOW + 7 * 24 * 60 * 60 * 1000,
      NOW,
    );
    expect(guest.skewMs).toBeNull();
    expect(guest.session.chatgpt.chats).toEqual(["new"]);
  });
});

describe("revealChat", () => {
  it("adds the chat to the revealed set", () => {
    const guest = revealChat(createGuestState(NOW), "chatgpt", "old");
    expect(guest.session.chatgpt.revealed).toEqual(["old"]);
    expect(
      revealChat(guest, "chatgpt", "old").session.chatgpt.revealed,
    ).toEqual(["old"]);
  });
});

describe("marks", () => {
  it("marks and unmarks a chat", () => {
    let marks = setMark(emptyMarks(), "chatgpt", "a", true);
    marks = setMark(marks, "chatgpt", "a", true);
    marks = setMark(marks, "chatgpt", "b", true);
    expect(marks.chatgpt).toEqual(["a", "b"]);
    marks = setMark(marks, "chatgpt", "a", false);
    expect(marks.chatgpt).toEqual(["b"]);
  });

  it("clears one site or all of them", () => {
    const marks = { chatgpt: ["a"], claude: ["b"], gemini: ["c"] };
    expect(clearMarks(marks, "claude")).toEqual({
      chatgpt: ["a"],
      claude: [],
      gemini: ["c"],
    });
    expect(clearMarks(marks)).toEqual(emptyMarks());
  });
});
