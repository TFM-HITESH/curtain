import { decodeChatGptIdTime } from "@/core";
import { describe, expect, it } from "vitest";
import { defineSite } from "../site/definition";
import {
  MAX_NEW_CHAT_AGE_MS,
  createdChat,
  type RouteChange,
} from "./created-chat";

const NOW = Date.UTC(2026, 10, 28, 12, 0, 0);

const claude = defineSite({
  id: "claude",
  hosts: ["claude.ai"],
  title: "Claude",
  routes: { newChat: /^\/new$/, chat: /^\/chat\/([0-9a-f-]+)$/ },
  surfaces: [],
});

const chatgpt = defineSite({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  title: "ChatGPT",
  routes: {
    newChat: /^\/$/,
    chat: /^\/(?:g\/g-p-[^/]+\/)?c\/([0-9a-f-]{36})$/,
  },
  idTime: decodeChatGptIdTime,
  surfaces: [],
});

function chatGptId(ms: number): string {
  const hex = Math.floor(ms / 1000)
    .toString(16)
    .padStart(8, "0");
  return `${hex}-0000-8000-8000-000000000000`;
}

const change = (
  from: string,
  to: string,
  kind: RouteChange["kind"] = "push",
): RouteChange => ({ from, to, kind });

describe("createdChat", () => {
  it("spots the move from the new-chat screen to a chat", () => {
    expect(createdChat(claude, change("/new", "/chat/abc-123"), NOW)).toEqual({
      chatId: "abc-123",
      serverTime: null,
    });
  });

  it("counts a replaced history entry too", () => {
    expect(
      createdChat(claude, change("/new", "/chat/abc", "replace"), NOW),
    ).toMatchObject({ chatId: "abc" });
  });

  it.each<[string, RouteChange]>([
    ["going back or forward", change("/new", "/chat/abc", "traverse")],
    ["reloading", change("/new", "/chat/abc", "reload")],
    ["moving between chats", change("/chat/old", "/chat/abc")],
    ["opening a chat from another page", change("/projects", "/chat/abc")],
    [
      "leaving the new-chat screen for another page",
      change("/new", "/settings"),
    ],
  ])("ignores %s", (_, routeChange) => {
    expect(createdChat(claude, routeChange, NOW)).toBeNull();
  });

  describe("on a site whose IDs carry a creation time", () => {
    it("passes the creation time along", () => {
      const id = chatGptId(NOW - 2000);
      expect(createdChat(chatgpt, change("/", `/c/${id}`), NOW)).toEqual({
        chatId: id,
        serverTime: Math.floor((NOW - 2000) / 1000) * 1000,
      });
    });

    it("works for chats inside projects", () => {
      const id = chatGptId(NOW);
      expect(
        createdChat(chatgpt, change("/", `/g/g-p-abc/c/${id}`), NOW),
      ).toMatchObject({ chatId: id });
    });

    it("rejects a chat the ID says is old", () => {
      const id = chatGptId(NOW - MAX_NEW_CHAT_AGE_MS - 60_000);
      expect(createdChat(chatgpt, change("/", `/c/${id}`), NOW)).toBeNull();
    });

    it("still counts the move if the ID's time can't be read", () => {
      const id = "f3a91c07-0000-4000-8000-000000000000";
      expect(createdChat(chatgpt, change("/", `/c/${id}`), NOW)).toEqual({
        chatId: id,
        serverTime: null,
      });
    });
  });
});
