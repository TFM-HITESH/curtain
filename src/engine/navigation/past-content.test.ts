import {
  createGuestState,
  decodeChatGptIdTime,
  emptyMarks,
  startSession,
  visibilityRules,
} from "@/core";
import { describe, expect, it } from "vitest";
import { defineSite } from "../site/definition";
import { showsPastContent } from "./past-content";

const START = Date.UTC(2026, 10, 28, 12, 0, 0);

const site = defineSite({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  title: "ChatGPT",
  routes: {
    newChat: /^\/$/,
    chat: /^\/c\/([0-9a-z-]+)$/,
    blocked: [/^\/scheduled\/archive/],
  },
  idTime: decodeChatGptIdTime,
  surfaces: [],
});

const rules = visibilityRules(
  {
    guest: startSession(START, { site: "chatgpt", chatId: "session" }),
    marks: emptyMarks(),
  },
  "chatgpt",
);

function chatGptId(ms: number): string {
  const hex = Math.floor(ms / 1000)
    .toString(16)
    .padStart(8, "0");
  return `${hex}-0000-8000-8000-000000000000`;
}

describe("showsPastContent", () => {
  it("is true for a chat from outside the session", () => {
    expect(showsPastContent(site, "/c/old", rules, START)).toBe(true);
  });

  it("is false for a session chat", () => {
    expect(showsPastContent(site, "/c/session", rules, START)).toBe(false);
  });

  it("uses the creation time in the ID", () => {
    const fresh = chatGptId(START + 60_000);
    expect(showsPastContent(site, `/c/${fresh}`, rules, START + 120_000)).toBe(
      false,
    );
  });

  it("is true for pages that are never shown in Guest mode", () => {
    expect(showsPastContent(site, "/scheduled/archive", rules, START)).toBe(
      true,
    );
  });

  it("is false for other pages", () => {
    expect(showsPastContent(site, "/", rules, START)).toBe(false);
    expect(showsPastContent(site, "/settings/general", rules, START)).toBe(
      false,
    );
  });

  it("treats any chat as past content until Guest mode's state is known", () => {
    expect(showsPastContent(site, "/c/session", null, START)).toBe(true);
    expect(showsPastContent(site, "/", null, START)).toBe(false);
  });

  it("works for sites without blocked pages or ID times", () => {
    const plain = defineSite({
      id: "claude",
      hosts: ["claude.ai"],
      title: "Claude",
      routes: { newChat: /^\/new$/, chat: /^\/chat\/([^/]+)$/ },
      surfaces: [],
    });
    const claudeRules = visibilityRules(
      { guest: createGuestState(START), marks: emptyMarks() },
      "claude",
    );
    expect(showsPastContent(plain, "/chat/x", claudeRules, START)).toBe(true);
    expect(showsPastContent(plain, "/projects", claudeRules, START)).toBe(
      false,
    );
  });
});
