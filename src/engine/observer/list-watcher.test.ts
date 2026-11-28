// @vitest-environment happy-dom
import {
  createGuestState,
  decodeChatGptIdTime,
  emptyMarks,
  visibilityRules,
  type GuestState,
} from "@/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineSite } from "../site/definition";
import { createListWatcher, type ListWatcher } from "./list-watcher";

const START = Date.UTC(2026, 10, 28, 12, 0, 0);

const site = defineSite({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  title: "ChatGPT",
  routes: { newChat: /^\/$/, chat: /^\/c\/([^/]+)/ },
  idTime: decodeChatGptIdTime,
  surfaces: [
    {
      kind: "filter",
      id: "chats",
      item: "[data-chat]",
      itemKind: "chat",
      idFrom: { attribute: "data-chat", match: /^chat:(.+)$/ },
    },
    {
      kind: "filter",
      id: "projects",
      item: "[data-project]",
      itemKind: "project",
      idFrom: { attribute: "data-project" },
      chats: {
        item: "[data-project] a[href]",
        idFrom: { href: /\/c\/([^/?#]+)/ },
      },
    },
    {
      kind: "filter",
      id: "search",
      item: "a[role=option]",
      itemKind: "chat",
      idFrom: { href: /\/c\/([^/?#]+)/ },
    },
    { kind: "collapse-empty", id: "groups", group: "section[data-group]" },
  ],
});

/** A ChatGPT-style ID created at `ms`. */
function idAt(ms: number): string {
  const hex = Math.floor(ms / 1000)
    .toString(16)
    .padStart(8, "0");
  return `${hex}-0000-8000-8000-000000000000`;
}

const guest: GuestState = {
  ...createGuestState(START),
  session: {
    ...createGuestState(START).session,
    chatgpt: { chats: ["session"], projects: [], items: [], revealed: [] },
  },
};
const rules = visibilityRules({ guest, marks: emptyMarks() }, "chatgpt");

let queue: (() => void)[] = [];
let watcher: ListWatcher;

function shown(selector: string): boolean {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  return element.hasAttribute("data-curtain-ok");
}

/** Lets the mutation observer deliver what has changed. */
async function mutations() {
  await Promise.resolve();
}

beforeEach(() => {
  queue = [];
  document.body.innerHTML = `
    <section data-group id="today">
      <div data-chat="chat:session" id="session"></div>
      <div data-chat="chat:old" id="old"></div>
    </section>
    <section data-group id="yesterday">
      <div data-chat="chat:older" id="older"></div>
    </section>
  `;
  watcher = createListWatcher(site, {
    now: () => START + 60_000,
    schedule: (callback) => queue.push(callback),
  });
});

afterEach(() => {
  watcher.stop();
});

describe("start", () => {
  it("decides every item already on the page straight away", () => {
    watcher.start(rules);
    expect(shown("#session")).toBe(true);
    expect(shown("#old")).toBe(false);
  });

  it("shows a group only if one of its items shows", () => {
    watcher.start(rules);
    expect(shown("#today")).toBe(true);
    expect(shown("#yesterday")).toBe(false);
  });

  it("clears marks left from an earlier session", () => {
    document.querySelector("#old")?.setAttribute("data-curtain-ok", "");
    watcher.start(rules);
    expect(shown("#old")).toBe(false);
  });

  it("switches to new rules when called again", () => {
    watcher.start(rules);
    const marked = visibilityRules(
      { guest, marks: { ...emptyMarks(), chatgpt: ["old"] } },
      "chatgpt",
    );
    watcher.start(marked);
    expect(shown("#old")).toBe(true);
  });
});

describe("items that appear later", () => {
  beforeEach(() => {
    watcher.start(rules);
  });

  it("are decided in the next batch, not before", async () => {
    document
      .querySelector("#yesterday")
      ?.insertAdjacentHTML(
        "beforeend",
        '<div data-chat="chat:session" id="late"></div>',
      );
    await mutations();
    expect(shown("#late")).toBe(false);
    expect(queue).toHaveLength(1);

    watcher.flush();
    expect(shown("#late")).toBe(true);
    expect(shown("#yesterday")).toBe(true);
  });

  it("are found inside added containers", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<section data-group id="new-group"><div><div data-chat="chat:session" id="nested"></div></div></section>',
    );
    await mutations();
    watcher.flush();
    expect(shown("#nested")).toBe(true);
    expect(shown("#new-group")).toBe(true);
  });

  it("show when their ID says they were created in the session", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div data-chat="chat:${idAt(START + 30_000)}" id="new"></div>
       <div data-chat="chat:${idAt(START - 3_600_000)}" id="before"></div>`,
    );
    await mutations();
    watcher.flush();
    expect(shown("#new")).toBe(true);
    expect(shown("#before")).toBe(false);
  });

  it("stay hidden when their ID can't be read", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="unexpected-format" id="odd"></div><div data-chat="" id="empty"></div>',
    );
    await mutations();
    watcher.flush();
    expect(shown("#odd")).toBe(false);
    expect(shown("#empty")).toBe(false);
  });

  it("are batched into one scheduled run", async () => {
    for (let i = 0; i < 5; i++) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div data-chat="chat:old-${String(i)}"></div>`,
      );
    }
    await mutations();
    expect(queue).toHaveLength(1);
  });

  it("ignore unrelated changes", async () => {
    document.body.insertAdjacentHTML("beforeend", "<p>Unrelated</p>");
    await mutations();
    expect(queue).toHaveLength(0);
  });
});

describe("reused rows", () => {
  beforeEach(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<a role="option" href="/c/session" id="result"></a>',
    );
    watcher.start(rules);
  });

  it("are hidden again when a link now points to an old chat", async () => {
    expect(shown("#result")).toBe(true);
    document.querySelector("#result")?.setAttribute("href", "/c/old");
    await mutations();
    watcher.flush();
    expect(shown("#result")).toBe(false);
  });

  it("are hidden again when their ID attribute changes", async () => {
    expect(shown("#session")).toBe(true);
    document.querySelector("#session")?.setAttribute("data-chat", "chat:old");
    await mutations();
    watcher.flush();
    expect(shown("#session")).toBe(false);
    expect(shown("#today")).toBe(false);
  });
});

describe("projects", () => {
  beforeEach(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-project="g-p-1" id="project"><a href="/c/old" id="project-old"></a></div>',
    );
    watcher.start(rules);
  });

  it("stay hidden while they hold only old chats", () => {
    expect(shown("#project")).toBe(false);
    expect(shown("#project-old")).toBe(false);
  });

  it("show once a session chat appears inside", async () => {
    document
      .querySelector("#project")
      ?.insertAdjacentHTML(
        "beforeend",
        '<a href="/c/session" id="project-new"></a>',
      );
    await mutations();
    watcher.flush();
    expect(shown("#project")).toBe(true);
    expect(shown("#project-new")).toBe(true);
    expect(shown("#project-old")).toBe(false);
  });
});

describe("stop", () => {
  it("stops deciding new items", async () => {
    watcher.start(rules);
    watcher.stop();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="chat:session" id="after-stop"></div>',
    );
    await mutations();
    watcher.flush();
    expect(queue).toHaveLength(0);
    expect(shown("#after-stop")).toBe(false);
  });

  it("drops a batch that was already scheduled", async () => {
    watcher.start(rules);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="chat:session" id="queued"></div>',
    );
    await mutations();
    watcher.stop();
    for (const run of queue) run();
    expect(shown("#queued")).toBe(false);
  });
});

describe("long lists", () => {
  const rows = (count: number, prefix: string) =>
    Array.from(
      { length: count },
      (_, i) => `<div data-chat="chat:${prefix}-${String(i)}"></div>`,
    ).join("");

  it("decides 1,000 existing items well within one frame's budget", () => {
    document.body.insertAdjacentHTML("beforeend", rows(1000, "existing"));
    const started = performance.now();
    watcher.start(rules);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("spreads a huge batch across frames", async () => {
    watcher = createListWatcher(site, {
      now: () => START,
      schedule: (callback) => queue.push(callback),
      budgetMs: 0,
    });
    watcher.start(rules);
    document.body.insertAdjacentHTML("beforeend", rows(50, "late"));
    await mutations();

    const first = queue.shift();
    first?.();
    expect(queue).toHaveLength(1);

    watcher.flush();
    const decided = document.querySelectorAll('[data-chat^="chat:late-"]');
    expect(decided).toHaveLength(50);
  });
});

describe("scheduling", () => {
  it("runs batches on the next animation frame by default", async () => {
    watcher = createListWatcher(site, { now: () => START });
    watcher.start(rules);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="chat:session" id="framed"></div>',
    );
    await vi.waitFor(() => {
      expect(shown("#framed")).toBe(true);
    });
  });

  it("schedules one batch for changes that arrive before it runs", async () => {
    watcher.start(rules);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="chat:a"></div>',
    );
    await mutations();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="chat:b"></div>',
    );
    await mutations();
    expect(queue).toHaveLength(1);
  });
});

describe("sites with fewer surfaces", () => {
  it("work with no groups", async () => {
    const flat = {
      ...site,
      surfaces: site.surfaces.filter((s) => s.kind !== "collapse-empty"),
    };
    watcher = createListWatcher(flat, {
      now: () => START,
      schedule: (callback) => queue.push(callback),
    });
    watcher.start(rules);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="chat:session" id="flat"></div>',
    );
    await mutations();
    watcher.flush();
    expect(shown("#flat")).toBe(true);
  });

  it("do nothing with no lists at all", async () => {
    watcher = createListWatcher(
      { ...site, surfaces: [] },
      { schedule: (callback) => queue.push(callback) },
    );
    watcher.start(rules);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-chat="chat:session"></div>',
    );
    await mutations();
    expect(queue).toHaveLength(0);
  });

  it("decide projects that list no chats", () => {
    const projectsOnly = defineSite({
      ...site,
      surfaces: [
        {
          kind: "filter",
          id: "projects",
          item: "[data-project]",
          itemKind: "project",
          idFrom: { attribute: "data-project" },
        },
      ],
    });
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-project="p" id="bare"></div>',
    );
    watcher = createListWatcher(projectsOnly, { now: () => START });
    watcher.start(rules);
    expect(shown("#bare")).toBe(false);
  });
});

describe("project chats without a readable ID", () => {
  it("don't count towards showing the project", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-project="p" id="odd-project"><a href="/settings" id="odd-link"></a></div>',
    );
    watcher.start(rules);
    expect(shown("#odd-project")).toBe(false);
    expect(shown("#odd-link")).toBe(false);
  });
});
