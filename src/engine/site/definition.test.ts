import { decodeChatGptIdTime } from "@/core";
import { describe, expect, it } from "vitest";
import { defineSite, siteProblems, type SiteDefinition } from "./definition";

const settings = {
  pattern: /^\/settings\/([^/?#]+)/,
  allowed: ["general", "voice"],
  fallback: "/settings/general",
};

/** A realistic definition, shaped like the ones in `src/sites`. */
const example = defineSite({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  title: "ChatGPT",
  routes: {
    newChat: /^\/$/,
    chat: /^\/(?:g\/g-p-[^/]+\/)?c\/([0-9a-f-]{36})/,
    settings,
    blocked: [/^\/scheduled\/archive/],
  },
  idTime: decodeChatGptIdTime,
  surfaces: [
    {
      kind: "filter",
      id: "sidebar-chats",
      item: "[data-sidebar-chatgpt-conversation-key]",
      itemKind: "chat",
      idFrom: {
        attribute: "data-sidebar-chatgpt-conversation-key",
        match: /:([^:]+)$/,
      },
    },
    {
      kind: "filter",
      id: "sidebar-projects",
      item: "[data-app-action-sidebar-project-row]",
      itemKind: "project",
      idFrom: { attribute: "data-app-action-sidebar-project-id" },
      chats: { item: 'a[href*="/c/"]', idFrom: { href: /\/c\/([^/?#]+)/ } },
    },
    { kind: "remove", id: "memory", match: '[data-testid="memory-entry"]' },
    {
      kind: "collapse-empty",
      id: "sidebar-groups",
      group: "section[data-app-action-sidebar-section]",
    },
  ],
});

function withChanges(changes: Partial<SiteDefinition>): SiteDefinition {
  return { ...example, ...changes };
}

describe("defineSite", () => {
  it("returns the definition unchanged", () => {
    const definition = { ...example };
    expect(defineSite(definition)).toBe(definition);
  });
});

describe("siteProblems", () => {
  it("accepts a well-formed definition", () => {
    expect(siteProblems(example)).toEqual([]);
  });

  it("needs at least one valid host", () => {
    expect(siteProblems(withChanges({ hosts: [] }))).toEqual(["has no hosts"]);
    expect(
      siteProblems(withChanges({ hosts: ["https://chatgpt.com"] })),
    ).toEqual(['host "https://chatgpt.com" isn\'t a host name']);
  });

  it("needs the chat route to capture the chat ID", () => {
    const routes = { ...example.routes, chat: /^\/c\/[0-9a-f-]+/ };
    expect(siteProblems(withChanges({ routes }))).toEqual([
      "the chat route needs a capture group for the chat ID",
    ]);
  });

  it("treats settings and blocked pages as optional", () => {
    const routes = { newChat: /^\/$/, chat: /^\/c\/([^/]+)/ };
    expect(siteProblems(withChanges({ routes }))).toEqual([]);
  });

  it("checks the settings route", () => {
    const noGroup = {
      ...example.routes,
      settings: {
        pattern: /^\/settings\/general/,
        allowed: ["general"],
        fallback: "/settings/general",
      },
    };
    expect(siteProblems(withChanges({ routes: noGroup }))).toEqual([
      "the settings route needs a capture group for the section",
      "the settings fallback isn't an allowed section",
    ]);

    const badFallback = {
      ...example.routes,
      settings: { ...settings, fallback: "/settings/account" },
    };
    expect(siteProblems(withChanges({ routes: badFallback }))).toEqual([
      "the settings fallback isn't an allowed section",
    ]);
  });

  it("rejects selectors that rely on class names or text", () => {
    const problems = siteProblems(
      withChanges({
        surfaces: [
          { kind: "remove", id: "a", match: ".memory-panel" },
          { kind: "collapse-empty", id: "b", group: '[aria-label="Today"]' },
          {
            kind: "filter",
            id: "c",
            item: "[data-row]",
            itemKind: "project",
            idFrom: { attribute: "data-id" },
            chats: { item: "a.chat", idFrom: { href: /\/c\/(\w+)/ } },
          },
        ],
      }),
    );
    expect(problems).toEqual([
      'surface "a": ".memory-panel" uses a class name',
      'surface "b": "[aria-label="Today"]" uses the "aria-label" attribute',
      'surface "c": "a.chat" uses a class name',
    ]);
  });

  it("checks where IDs come from", () => {
    const problems = siteProblems(
      withChanges({
        surfaces: [
          {
            kind: "filter",
            id: "a",
            item: "[data-row]",
            itemKind: "chat",
            idFrom: { href: /\/c\/\w+/ },
          },
          {
            kind: "filter",
            id: "b",
            item: "[data-row]",
            itemKind: "chat",
            idFrom: { attribute: "class" },
          },
          {
            kind: "filter",
            id: "c",
            item: "[data-row]",
            itemKind: "project",
            idFrom: { attribute: "data-id" },
            chats: {
              item: "a",
              idFrom: { attribute: "data-id", match: /\w+/ },
            },
          },
        ],
      }),
    );
    expect(problems).toEqual([
      'surface "a": the ID pattern needs a capture group for the ID',
      'surface "b": reads the "class" attribute, which isn\'t a stable hook',
      'surface "c": the ID pattern needs a capture group for the ID',
    ]);
  });

  it("rejects duplicate surface IDs", () => {
    const remove = { kind: "remove", id: "same", match: "[data-x]" } as const;
    expect(siteProblems(withChanges({ surfaces: [remove, remove] }))).toEqual([
      'surface "same" is defined twice',
    ]);
  });
});

describe("anchors", () => {
  it("are checked like other selectors", () => {
    expect(
      siteProblems(
        withChanges({
          anchors: [
            { id: "sidebar", selector: "nav[data-sidebar]" },
            { id: "menu", selector: ".profile-menu", on: /^\/c\// },
            { id: "sidebar", selector: "[role=navigation]" },
          ],
        }),
      ),
    ).toEqual([
      'anchor "menu": ".profile-menu" uses a class name',
      'anchor "sidebar" is defined twice',
    ]);
  });
});
