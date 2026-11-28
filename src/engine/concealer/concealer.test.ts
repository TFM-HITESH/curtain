// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineSite } from "../site/definition";
import { conceal, installConcealer, reveal, type Concealer } from "./concealer";
import { guardCss, splitSelectorList } from "./guard-css";

const site = defineSite({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  title: "ChatGPT",
  routes: { newChat: /^\/$/, chat: /^\/c\/([^/]+)/ },
  surfaces: [
    {
      kind: "filter",
      id: "chats",
      item: "[data-chat]",
      itemKind: "chat",
      idFrom: { attribute: "data-chat" },
    },
    {
      kind: "filter",
      id: "projects",
      item: "[data-project]",
      itemKind: "project",
      idFrom: { attribute: "data-project" },
      chats: { item: "[data-project] a", idFrom: { href: /\/c\/(\w+)/ } },
    },
    { kind: "remove", id: "memory", match: "[data-memory], [data-account]" },
    { kind: "collapse-empty", id: "groups", group: "section[data-group]" },
  ],
});

const PAGE = `
  <section data-group>
    <div data-chat="old" id="old">Old chat</div>
    <div data-chat="new" id="new">New chat</div>
  </section>
  <div data-project="p" id="project"><a href="/c/x" id="project-chat">x</a></div>
  <div data-memory id="memory">Memory</div>
  <div data-account id="account">Account</div>
  <main id="main">Unrelated</main>
`;

function find(selector: string): Element {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  return element;
}

/** Whether the element or any of its ancestors is hidden. */
function hidden(id: string): boolean {
  let element = document.getElementById(id);
  if (!element) throw new Error(`No element #${id}`);
  for (; element; element = element.parentElement) {
    if (getComputedStyle(element).display === "none") return true;
  }
  return false;
}

let concealer: Concealer;

beforeEach(() => {
  document.body.innerHTML = PAGE;
  concealer = installConcealer(site);
});

afterEach(() => {
  concealer.stop();
});

describe("splitSelectorList", () => {
  it("splits on top-level commas only", () => {
    expect(
      splitSelectorList('a, [data-x="1,2"], :is(b, c) d , :not([y],[z])'),
    ).toEqual(["a", '[data-x="1,2"]', ":is(b, c) d", ":not([y],[z])"]);
  });

  it("handles escaped quotes and drops empty parts", () => {
    expect(splitSelectorList('[data-x="a\\"b,c"], , e')).toEqual([
      '[data-x="a\\"b,c"]',
      "e",
    ]);
  });
});

describe("guardCss", () => {
  it("writes one rule per selector, wrapped so selector lists stay scoped", () => {
    const css = guardCss(site);
    expect(css.split("\n")).toHaveLength(5);
    expect(css).toContain(
      ':root[data-curtain="pending"]) [data-memory], :where(',
    );
  });

  it("is empty for a site with nothing to hide", () => {
    expect(guardCss({ ...site, surfaces: [] })).toBe("");
  });
});

describe("while pending", () => {
  it("starts in pending mode", () => {
    expect(concealer.mode).toBe("pending");
    expect(document.documentElement.getAttribute("data-curtain")).toBe(
      "pending",
    );
  });

  it("hides every listed item, even ones that will be allowed later", () => {
    for (const id of [
      "old",
      "new",
      "project",
      "project-chat",
      "memory",
      "account",
    ]) {
      expect(hidden(id)).toBe(true);
    }
  });

  it("leaves everything else alone", () => {
    expect(hidden("main")).toBe(false);
  });
});

describe("in Guest mode", () => {
  beforeEach(() => {
    concealer.setMode("guest");
  });

  it("shows only items the engine allows", () => {
    reveal(find("section[data-group]"));
    reveal(find("#new"));
    expect(hidden("new")).toBe(false);
    expect(hidden("old")).toBe(true);
  });

  it("keeps a group hidden until it's allowed", () => {
    expect(hidden("old")).toBe(true);
    const group = find("section[data-group]");
    expect(getComputedStyle(group).display).toBe("none");
    reveal(group);
    expect(getComputedStyle(group).display).not.toBe("none");
  });

  it("hides chats inside a project until each is allowed", () => {
    reveal(find("#project"));
    expect(hidden("project")).toBe(false);
    expect(hidden("project-chat")).toBe(true);
    reveal(find("#project-chat"));
    expect(hidden("project-chat")).toBe(false);
  });

  it("never shows removed items, even if they're marked", () => {
    reveal(find("#memory"));
    expect(hidden("memory")).toBe(true);
    expect(hidden("account")).toBe(true);
  });

  it("hides an item again when it's concealed", () => {
    const item = find("#new");
    reveal(item);
    conceal(item);
    expect(hidden("new")).toBe(true);
  });

  it("hides items added later", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="late" id="late"></div>',
    );
    expect(hidden("late")).toBe(true);
  });
});

describe("with Guest mode off", () => {
  it("shows everything", () => {
    concealer.setMode("off");
    for (const id of ["old", "new", "project", "memory", "account"]) {
      expect(hidden(id)).toBe(false);
    }
  });
});

describe("when the site rewrites the page", () => {
  it("puts the mode back if it's removed or changed", async () => {
    concealer.setMode("guest");
    document.documentElement.removeAttribute("data-curtain");
    await Promise.resolve();
    expect(document.documentElement.getAttribute("data-curtain")).toBe("guest");

    document.documentElement.setAttribute("data-curtain", "off");
    await Promise.resolve();
    expect(document.documentElement.getAttribute("data-curtain")).toBe("guest");
  });

  it("puts the stylesheet back if it's removed", async () => {
    document.querySelector("style[data-curtain-guard]")?.remove();
    await Promise.resolve();
    expect(document.querySelector("style[data-curtain-guard]")).not.toBeNull();
    expect(hidden("old")).toBe(true);
  });
});

describe("stop", () => {
  it("removes the stylesheet and the mode", () => {
    concealer.stop();
    expect(document.querySelector("style[data-curtain-guard]")).toBeNull();
    expect(document.documentElement.hasAttribute("data-curtain")).toBe(false);
  });
});
