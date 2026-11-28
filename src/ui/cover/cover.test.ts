// @vitest-environment happy-dom
import { defineSite, installConcealer, type Concealer } from "@/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COVER_TEXT } from "../strings";
import { createCover, type Cover, type CoverOptions } from "./cover";

const spec = { target: "main[data-thread]", newChatHref: "/" };

const site = defineSite({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  title: "ChatGPT",
  routes: { newChat: /^\/$/, chat: /^\/c\/([^/]+)/ },
  surfaces: [],
  cover: spec,
});

let cover: Cover;
let concealer: Concealer;

function make(options: Partial<CoverOptions> = {}): Cover {
  cover = createCover({
    spec,
    text: COVER_TEXT,
    onNewChat: vi.fn(),
    onExit: vi.fn(),
    ...options,
  });
  return cover;
}

function coverElement(): HTMLElement | null {
  return document.querySelector("[data-curtain-cover]");
}

/** Whether the element is invisible, on its own or through an ancestor. */
function invisible(element: Element): boolean {
  return getComputedStyle(element).visibility === "hidden";
}

function find(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  return element;
}

/** Lets the mutation observer react. */
async function mutations() {
  await Promise.resolve();
}

beforeEach(() => {
  document.body.innerHTML = `
    <nav data-sidebar>Sidebar</nav>
    <main data-thread>
      <h1 id="chat-title">Old chat title</h1>
      <div id="message"><p id="text">Old message</p></div>
    </main>
  `;
  concealer = installConcealer(site);
  concealer.setMode("guest");
});

afterEach(() => {
  cover.hide();
  concealer.stop();
  vi.restoreAllMocks();
});

describe("createCover", () => {
  it("covers the chat area when shown", () => {
    make().show();
    const element = coverElement();
    expect(element?.parentElement).toBe(document.querySelector("main"));
    expect(document.documentElement.hasAttribute("data-curtain-past")).toBe(
      true,
    );
    expect(cover.shown).toBe(true);
  });

  it("hides everything under it, and nothing outside the chat area", () => {
    make().show();
    for (const id of ["chat-title", "message", "text"]) {
      expect(invisible(find(`#${id}`))).toBe(true);
    }
    expect(invisible(find("nav"))).toBe(false);
    expect(invisible(find("[data-curtain-cover]"))).toBe(false);
  });

  it("keeps hidden content hidden even if it asks to be visible", () => {
    find("#text").style.visibility = "visible";
    make().show();
    expect(invisible(find("#text"))).toBe(true);
  });

  it("shows the message, the actions and a lock icon", () => {
    make().show();
    const element = find("[data-curtain-cover]");
    expect(element.getAttribute("role")).toBe("region");
    const heading = element.querySelector("h2");
    expect(heading?.textContent).toBe("This chat is hidden");
    expect(element.getAttribute("aria-labelledby")).toBe(heading?.id);
    expect(element.querySelector("p")?.textContent).toContain("Guest mode");
    expect(element.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    const labels = [...element.querySelectorAll("button")].map(
      (button) => button.textContent,
    );
    expect(labels).toEqual(["New chat", "Exit guest mode"]);
  });

  it("offers Show this chat only when it can be used", () => {
    const onReveal = vi.fn();
    make({ onReveal }).show();
    const reveal = [
      ...document.querySelectorAll("[data-curtain-cover] button"),
    ].at(-1);
    expect(reveal?.textContent).toBe("Show this chat");
    (reveal as HTMLButtonElement).click();
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("calls the actions when their buttons are pressed", () => {
    const onNewChat = vi.fn();
    const onExit = vi.fn();
    make({ onNewChat, onExit }).show();
    const [newChat, exit] = document.querySelectorAll<HTMLButtonElement>(
      "[data-curtain-cover] button",
    );
    newChat?.click();
    exit?.click();
    expect(onNewChat).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("uses real buttons, so it works from the keyboard", () => {
    make().show();
    for (const button of document.querySelectorAll(
      "[data-curtain-cover] button",
    )) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  it("adds its styles once, when it first appears", () => {
    make().show();
    cover.show();
    expect(
      document.querySelectorAll("style[data-curtain-cover-style]"),
    ).toHaveLength(1);
    expect(document.querySelectorAll("[data-curtain-cover]")).toHaveLength(1);
  });

  it("turns off animation for people who prefer reduced motion", () => {
    make().show();
    const css = document.querySelector(
      "style[data-curtain-cover-style]",
    )?.textContent;
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("positions a static chat area and restores it on hide", () => {
    make().show();
    const main = find("main");
    expect(main.style.position).toBe("relative");
    cover.hide();
    expect(main.style.position).toBe("");
  });

  it("leaves an already positioned chat area alone", () => {
    const main = find("main");
    main.style.position = "absolute";
    make().show();
    cover.hide();
    expect(main.style.position).toBe("absolute");
  });

  it("waits for the chat area to appear", async () => {
    document.querySelector("main")?.remove();
    make().show();
    expect(coverElement()).toBeNull();
    expect(
      document.querySelector("style[data-curtain-cover-style]"),
    ).toBeNull();
    document.body.insertAdjacentHTML("beforeend", "<main data-thread></main>");
    await mutations();
    expect(coverElement()?.parentElement).toBe(document.querySelector("main"));
  });

  it("moves to a re-rendered chat area", async () => {
    make().show();
    document
      .querySelector("main")
      ?.replaceWith(
        Object.assign(document.createElement("main"), { id: "fresh" }),
      );
    document.getElementById("fresh")?.setAttribute("data-thread", "");
    await mutations();
    await mutations();
    expect(coverElement()?.parentElement?.id).toBe("fresh");
  });

  it("removes everything when hidden", () => {
    make().show();
    cover.hide();
    expect(coverElement()).toBeNull();
    expect(
      document.querySelector("style[data-curtain-cover-style]"),
    ).toBeNull();
    expect(document.documentElement.hasAttribute("data-curtain-past")).toBe(
      false,
    );
    expect(cover.shown).toBe(false);
    expect(invisible(find("#text"))).toBe(false);
  });
});
