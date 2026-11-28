import { describe, expect, it } from "vitest";
import { selectorProblems } from "./selectors";

describe("selectorProblems", () => {
  it.each([
    "nav[data-app-navigation-rail]",
    '[role=listitem][data-sidebar-chatgpt-conversation-key^="chatgpt:"]',
    'a[role=option][href*="/c/"]',
    "section[data-app-action-sidebar-section]",
    "[role=menu][data-radix-menu-content] [role=menuitem]",
    'nav[data-app-navigation-rail] button[aria-haspopup="menu"]:last-of-type',
    '[aria-expanded="true"] > li:not([data-pinned]):nth-of-type(2)',
    'div[id^="command-palette-item-"]',
    'a[href="/settings/general.html"]',
    "[data-test-id='sidenav']",
    "main :is(header, footer)",
    "section:has(> [role=listitem])",
    'input[type="checkbox"]',
  ])("accepts %s", (selector) => {
    expect(selectorProblems(selector)).toEqual([]);
  });

  it.each([
    ["a.itemBase-Uk8vyp", "uses a class name"],
    ["nav > .sidebar", "uses a class name"],
    ["#__next main", "uses an ID selector"],
    ['[class*="sidebar"]', 'uses the "class" attribute'],
    [
      'button[aria-label="Open profile menu"]',
      'uses the "aria-label" attribute',
    ],
    ['img[alt="Avatar"]', 'uses the "alt" attribute'],
    ['[title="Settings"]', 'uses the "title" attribute'],
    ['[style*="display"]', 'uses the "style" attribute'],
    ["a:hover", 'uses the ":hover" pseudo-class'],
    ["li:contains(Settings)", 'uses the ":contains" pseudo-class'],
    ["   ", "is empty"],
  ])("rejects %s", (selector, problem) => {
    expect(selectorProblems(selector)).toContain(problem);
  });

  it("isn't fooled by dots or hashes inside attribute values", () => {
    expect(selectorProblems('a[href="/c/abc.def#top"][data-x=".y"]')).toEqual(
      [],
    );
  });

  it("allows pseudo-elements", () => {
    expect(selectorProblems("[data-curtain-pill]::before")).toEqual([]);
  });

  it("reports every problem it finds", () => {
    expect(selectorProblems('.a #b [class="c"]')).toHaveLength(3);
  });
});
