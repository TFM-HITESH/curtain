import { createGuard, type Guard } from "../safety/guard";
import type { MenuSpec, SiteDefinition } from "../site/definition";

/**
 * Adding our item to a site's own menus.
 *
 * When a menu opens, one of its native items is copied, given our label and
 * icon, and placed after the item the site definition names. The copy keeps
 * the site's markup and attributes, so it inherits the site's styles in light
 * and dark mode. Menus are often rendered fresh each time they open, so the
 * item is put back whenever it goes missing.
 */

/** The attribute that marks our item, holding the menu's ID. */
export const MENU_ITEM_ATTRIBUTE = "data-curtain-menu-item";

export interface MenuItem {
  readonly label: string;
  /** Builds the icon, which replaces the copied item's own. */
  readonly icon?: (doc: Document) => SVGSVGElement;
  readonly onSelect: () => void;
}

export interface MenuInjectorOptions {
  readonly doc?: Document;
  readonly guard?: Guard;
  /** Called when an open menu doesn't have the item we copy, so the site may have changed. */
  readonly onMissing?: (menuId: string) => void;
}

export interface MenuInjector {
  start(): void;
  /** Updates open menus, for example after Guest mode changes. */
  refresh(): void;
  /** Stops watching and removes our items. */
  stop(): void;
}

/** Attributes that belong to the original item and would confuse the site. */
const COPIED_ATTRIBUTES_TO_DROP = [
  "id",
  "href",
  "aria-controls",
  "aria-expanded",
  "aria-haspopup",
  "data-state",
  "data-highlighted",
  "data-disabled",
  "aria-disabled",
];

const SVG_ATTRIBUTES_TO_KEEP = ["class", "width", "height", "aria-hidden"];

export function createMenuInjector(
  site: SiteDefinition,
  itemFor: (menuId: string) => MenuItem | null,
  {
    doc = document,
    guard = createGuard(),
    onMissing = () => undefined,
  }: MenuInjectorOptions = {},
): MenuInjector {
  const specs = site.menus ?? [];
  let observer: MutationObserver | null = null;
  /** The label each placed item was built with, to know when to rebuild. */
  const labels = new WeakMap<Element, string>();

  function firstNative(menu: Element, selector: string): Element | null {
    for (const element of menu.querySelectorAll(selector)) {
      if (!element.closest(`[${MENU_ITEM_ATTRIBUTE}]`)) return element;
    }
    return null;
  }

  function controlledBy(menu: Element, spec: MenuSpec): boolean {
    if (spec.trigger === undefined) return true;
    if (!menu.id) return false;
    return [...doc.querySelectorAll(spec.trigger)].some(
      (trigger) => trigger.getAttribute("aria-controls") === menu.id,
    );
  }

  function setLabel(root: Element, label: string) {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const inIcon = node.parentElement?.closest("svg") != null;
      if (!inIcon && node.nodeValue?.trim()) texts.push(node as Text);
    }
    const [first, ...rest] = texts;
    if (!first) {
      root.append(label);
      return;
    }
    first.nodeValue = label;
    for (const text of rest) text.nodeValue = "";
  }

  function setIcon(root: Element, icon: SVGSVGElement) {
    const original = root.querySelector("svg");
    if (!original) return;
    for (const name of SVG_ATTRIBUTES_TO_KEEP) {
      const value = original.getAttribute(name);
      if (value !== null) icon.setAttribute(name, value);
    }
    original.replaceWith(icon);
  }

  function highlight(element: Element, on: boolean) {
    if (on) element.setAttribute("data-highlighted", "");
    else element.removeAttribute("data-highlighted");
  }

  function build(
    template: Element,
    spec: MenuSpec,
    item: MenuItem,
    menu: Element,
  ) {
    const copy = template.cloneNode(true) as HTMLElement;
    for (const element of [copy, ...copy.querySelectorAll("*")]) {
      for (const name of COPIED_ATTRIBUTES_TO_DROP)
        element.removeAttribute(name);
    }
    copy.setAttribute(MENU_ITEM_ATTRIBUTE, spec.id);
    setLabel(copy, item.label);
    if (item.icon) setIcon(copy, item.icon(doc));

    const select = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      guard.run(FEATURE, item.onSelect);
      // Close the menu the way a keyboard user would.
      menu.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    };
    copy.addEventListener("click", select);
    copy.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") select(event);
    });
    // The site highlights its own items from script, so do the same.
    copy.addEventListener("pointerenter", () => {
      highlight(copy, true);
    });
    copy.addEventListener("pointerleave", () => {
      highlight(copy, false);
    });
    copy.addEventListener("focus", () => {
      highlight(copy, true);
    });
    copy.addEventListener("blur", () => {
      highlight(copy, false);
    });
    labels.set(copy, item.label);
    return copy;
  }

  function decorate(menu: Element, spec: MenuSpec) {
    const existing = menu.querySelector(
      `[${MENU_ITEM_ATTRIBUTE}="${spec.id}"]`,
    );
    const item = itemFor(spec.id);
    if (!item) {
      existing?.remove();
      return;
    }
    const template = firstNative(menu, spec.template);
    if (!template) {
      existing?.remove();
      onMissing(spec.id);
      return;
    }
    const anchor =
      spec.after === undefined ? template : firstNative(menu, spec.after);
    if (!anchor) {
      existing?.remove();
      onMissing(spec.id);
      return;
    }
    const inPlace =
      existing?.previousElementSibling === anchor &&
      labels.get(existing) === item.label;
    if (inPlace) return;
    existing?.remove();
    anchor.after(build(template, spec, item, menu));
  }

  function process() {
    for (const spec of specs) {
      for (const menu of doc.querySelectorAll(spec.menu)) {
        if (controlledBy(menu, spec)) decorate(menu, spec);
      }
    }
  }

  const run = () => {
    guard.run(FEATURE, process);
  };

  return {
    start() {
      if (specs.length === 0 || observer) return;
      run();
      observer = new MutationObserver(run);
      // Menus are usually portalled to the end of <body> when they open.
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    },
    refresh: run,
    stop() {
      observer?.disconnect();
      observer = null;
      for (const element of doc.querySelectorAll(`[${MENU_ITEM_ATTRIBUTE}]`)) {
        element.remove();
      }
    },
  };
}

/** The name errors in menus are reported under. */
const FEATURE = "menu";
