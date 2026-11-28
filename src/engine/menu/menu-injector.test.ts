// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGuard } from "../safety/guard";
import { defineSite, type MenuSpec } from "../site/definition";
import {
  createMenuInjector,
  type MenuInjector,
  type MenuItem,
} from "./menu-injector";

const profile: MenuSpec = {
  id: "profile",
  menu: "[role=menu][data-radix-menu-content]",
  trigger: "nav[data-rail] button[aria-haspopup=menu]",
  template: '[role=menuitem]:has(use[href*="settings"])',
};

function siteWith(menus: readonly MenuSpec[]) {
  return defineSite({
    id: "chatgpt",
    hosts: ["chatgpt.com"],
    title: "ChatGPT",
    routes: { newChat: /^\/$/, chat: /^\/c\/([^/]+)/ },
    surfaces: [],
    menus,
  });
}

const row = (icon: string, label: string, extra = "") => `
  <div role="menuitem" data-radix-collection-item tabindex="-1" data-state="closed" ${extra}>
    <div data-menu-row-content>
      <svg class="icon-sm" width="16" height="16" aria-hidden="true"><use href="/icons.svg#codex-icon-${icon}"></use></svg>
      <span>${label}</span>
    </div>
  </div>`;

const MENU = `
  <div data-radix-popper-content-wrapper>
    <div role="menu" id="radix-1" data-radix-menu-content>
      ${row("person", "Profile", 'id="profile-item"')}
      ${row("settings", "Settings")}
      <div role="separator"></div>
      ${row("help", "Help")}
    </div>
  </div>`;

let injector: MenuInjector;
let onSelect: ReturnType<typeof vi.fn<() => void>>;
let item: MenuItem | null;

function icon(doc: Document) {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("data-test-icon", "");
  return svg;
}

function ours(): HTMLElement | null {
  return document.querySelector("[data-curtain-menu-item]");
}

function rowLabels(): string[] {
  return [...document.querySelectorAll("[role=menu] [role=menuitem]")].map(
    (element) => element.textContent.trim(),
  );
}

/** Lets the mutation observer react. */
async function mutations() {
  await Promise.resolve();
}

beforeEach(() => {
  document.body.innerHTML = `
    <nav data-rail><button aria-haspopup="menu" aria-controls="radix-1">Me</button></nav>
    ${MENU}`;
  onSelect = vi.fn<() => void>();
  item = { label: "Guest mode", icon, onSelect };
  injector = createMenuInjector(siteWith([profile]), () => item);
});

afterEach(() => {
  injector.stop();
});

describe("createMenuInjector", () => {
  it("adds our item right after the one it copies", () => {
    injector.start();
    expect(rowLabels()).toEqual(["Profile", "Settings", "Guest mode", "Help"]);
  });

  it("keeps the site's markup and drops what belongs to the original", () => {
    injector.start();
    const element = ours();
    expect(element?.getAttribute("role")).toBe("menuitem");
    expect(element?.hasAttribute("data-radix-collection-item")).toBe(true);
    expect(element?.getAttribute("tabindex")).toBe("-1");
    expect(element?.hasAttribute("data-state")).toBe(false);
    expect(element?.getAttribute("data-curtain-menu-item")).toBe("profile");
  });

  it("swaps in our icon with the original's size and classes", () => {
    injector.start();
    const svg = ours()?.querySelector("svg");
    expect(svg?.hasAttribute("data-test-icon")).toBe(true);
    expect(svg?.getAttribute("class")).toBe("icon-sm");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(ours()?.querySelector("use")).toBeNull();
  });

  it("runs the action and closes the menu when clicked", () => {
    injector.start();
    const closed = vi.fn();
    document
      .querySelector("[role=menu]")
      ?.addEventListener("keydown", (event) => {
        if ((event as KeyboardEvent).key === "Escape") closed();
      });
    ours()?.click();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("works from the keyboard", () => {
    injector.start();
    const element = ours();
    for (const key of ["Enter", " ", "ArrowDown"]) {
      element?.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    }
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("highlights like the site's own items", () => {
    injector.start();
    const element = ours();
    if (!element) throw new Error("No item");
    element.dispatchEvent(new Event("pointerenter"));
    expect(element.hasAttribute("data-highlighted")).toBe(true);
    element.dispatchEvent(new Event("pointerleave"));
    expect(element.hasAttribute("data-highlighted")).toBe(false);
    element.dispatchEvent(new Event("focus"));
    expect(element.hasAttribute("data-highlighted")).toBe(true);
    element.dispatchEvent(new Event("blur"));
    expect(element.hasAttribute("data-highlighted")).toBe(false);
  });

  it("adds the item when a menu opens later, and again each time", async () => {
    document.querySelector("[data-radix-popper-content-wrapper]")?.remove();
    injector.start();
    expect(ours()).toBeNull();

    document.body.insertAdjacentHTML("beforeend", MENU);
    await mutations();
    expect(rowLabels()).toEqual(["Profile", "Settings", "Guest mode", "Help"]);

    document.querySelector("[data-radix-popper-content-wrapper]")?.remove();
    document.body.insertAdjacentHTML("beforeend", MENU);
    await mutations();
    expect(document.querySelectorAll("[data-curtain-menu-item]")).toHaveLength(
      1,
    );
  });

  it("doesn't add duplicates as the page changes", async () => {
    injector.start();
    document.body.insertAdjacentHTML("beforeend", "<p>unrelated</p>");
    await mutations();
    await mutations();
    expect(document.querySelectorAll("[data-curtain-menu-item]")).toHaveLength(
      1,
    );
  });

  it("only changes the menu its trigger controls", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      MENU.replace('id="radix-1"', 'id="radix-other"'),
    );
    injector.start();
    const menus = document.querySelectorAll("[role=menu]");
    expect(menus[0]?.querySelector("[data-curtain-menu-item]")).not.toBeNull();
    expect(menus[1]?.querySelector("[data-curtain-menu-item]")).toBeNull();
  });

  it("ignores a menu without an ID when a trigger is required", () => {
    document.querySelector("[role=menu]")?.removeAttribute("id");
    injector.start();
    expect(ours()).toBeNull();
  });

  it("works without a trigger and with a separate anchor", () => {
    injector = createMenuInjector(
      siteWith([
        {
          id: "plain",
          menu: "[role=menu]",
          template: '[role=menuitem]:has(use[href*="settings"])',
          after: '[role=menuitem]:has(use[href*="help"])',
        },
      ]),
      () => item,
    );
    injector.start();
    expect(rowLabels()).toEqual(["Profile", "Settings", "Help", "Guest mode"]);
  });

  it("updates open menus when the item changes", () => {
    injector.start();
    item = { label: "Exit guest mode", icon, onSelect };
    injector.refresh();
    expect(rowLabels()).toEqual([
      "Profile",
      "Settings",
      "Exit guest mode",
      "Help",
    ]);
    item = null;
    injector.refresh();
    expect(ours()).toBeNull();
  });

  it("reports a menu that has changed shape and adds nothing", () => {
    const onMissing = vi.fn();
    injector = createMenuInjector(
      siteWith([
        { ...profile, template: '[role=menuitem]:has(use[href*="gone"])' },
      ]),
      () => item,
      { onMissing },
    );
    injector.start();
    expect(ours()).toBeNull();
    expect(onMissing).toHaveBeenCalledWith("profile");
  });

  it("reports a missing anchor too, and removes a stale item", () => {
    const onMissing = vi.fn();
    const spec = {
      ...profile,
      after: '[role=menuitem]:has(use[href*="help"])',
    };
    injector = createMenuInjector(siteWith([spec]), () => item, { onMissing });
    injector.start();
    expect(ours()).not.toBeNull();
    document.querySelector('[role=menuitem]:has(use[href*="help"])')?.remove();
    injector.refresh();
    expect(ours()).toBeNull();
    expect(onMissing).toHaveBeenCalledWith("profile");
  });

  it("removes a stale item when the item it copies disappears", () => {
    injector.start();
    document
      .querySelector('[role=menuitem]:has(use[href*="settings"])')
      ?.remove();
    injector.refresh();
    expect(ours()).toBeNull();
  });

  it("copes with items that have no text or icon", () => {
    const menu = document.querySelector("[role=menu]");
    if (menu)
      menu.innerHTML = '<div role="menuitem" data-kind="settings"></div>';
    injector = createMenuInjector(
      siteWith([
        { id: "bare", menu: "[role=menu]", template: "[data-kind=settings]" },
      ]),
      () => item,
    );
    injector.start();
    expect(ours()?.textContent).toBe("Guest mode");
    expect(ours()?.querySelector("svg")).toBeNull();
  });

  it("works without an icon", () => {
    item = { label: "Guest mode", onSelect };
    injector.start();
    expect(ours()?.querySelector("use")).not.toBeNull();
  });

  it("removes its items and stops when asked", async () => {
    injector.start();
    injector.stop();
    expect(ours()).toBeNull();
    document.querySelector("[data-radix-popper-content-wrapper]")?.remove();
    document.body.insertAdjacentHTML("beforeend", MENU);
    await mutations();
    expect(ours()).toBeNull();
  });

  it("does nothing on a site without menus", () => {
    injector = createMenuInjector(siteWith([]), () => item);
    injector.start();
    expect(ours()).toBeNull();
  });

  it("contains an action that throws", () => {
    const guard = createGuard();
    injector = createMenuInjector(
      siteWith([profile]),
      () => ({
        label: "Guest mode",
        onSelect: () => {
          throw new Error("boom");
        },
      }),
      { guard },
    );
    injector.start();
    expect(() => ours()?.click()).not.toThrow();
    expect(guard.failed("menu")).toBe(true);
  });
});
