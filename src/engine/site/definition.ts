import type { IdTimeDecoder, SiteId } from "@/core";
import { selectorProblems } from "./selectors";

/**
 * How a supported site is described.
 *
 * A site definition is data: where its routes are, which lists hold past
 * content and how to read an item's ID. The engine does all the DOM work, so
 * when a site changes, the fix is usually one line in its definition.
 */

/** A CSS selector using only stable hooks (see `selectorProblems`). */
export type Selector = string;

/** Where an item's ID comes from. */
export type IdSource =
  /** An attribute on the item. With `match`, the first capture group is the ID. */
  | { readonly attribute: string; readonly match?: RegExp }
  /** The URL of the item's link (the item itself or the first link inside it). */
  | { readonly href: RegExp };

export type ItemKind = "chat" | "project" | "item";

export type Surface =
  /** A list whose items show only if they belong to the session. */
  | {
      readonly kind: "filter";
      readonly id: string;
      readonly item: Selector;
      readonly itemKind: ItemKind;
      readonly idFrom: IdSource;
      /** For projects: the chat rows inside, so a project with a visible chat shows. */
      readonly chats?: { readonly item: Selector; readonly idFrom: IdSource };
    }
  /** Something that's never rendered in Guest mode, like account administration. */
  | { readonly kind: "remove"; readonly id: string; readonly match: Selector }
  /** A group, like "Yesterday", that's hidden when none of its items are visible. */
  | {
      readonly kind: "collapse-empty";
      readonly id: string;
      readonly group: Selector;
    };

export interface Routes {
  /** The new-chat screen. */
  readonly newChat: RegExp;
  /** A chat page. The first capture group is the chat ID. */
  readonly chat: RegExp;
  /** Settings sections. The first capture group is the section. */
  readonly settings?: {
    readonly pattern: RegExp;
    /** Sections a guest may open. */
    readonly allowed: readonly string[];
    /** Where a disallowed section sends the guest. Must be an allowed section's URL. */
    readonly fallback: string;
  };
  /** Pages that list past content and are never shown in Guest mode. */
  readonly blocked?: readonly RegExp[];
}

export interface SiteDefinition {
  readonly id: SiteId;
  /** Host names the site runs on, such as `chatgpt.com`. */
  readonly hosts: readonly string[];
  /** The tab title shown while a past chat is covered, such as "ChatGPT". */
  readonly title: string;
  readonly routes: Routes;
  /** Reads creation times from this site's IDs, if they carry them. */
  readonly idTime?: IdTimeDecoder;
  readonly surfaces: readonly Surface[];
  /**
   * Elements that should always be on the page, such as the sidebar. If one
   * goes missing, the site has probably changed, and the popup says so.
   */
  readonly anchors?: readonly Anchor[];
  /** Where and how a past chat is covered. */
  readonly cover?: CoverSpec;
  /** Site menus that get a Guest mode item. */
  readonly menus?: readonly MenuSpec[];
}

/**
 * A site menu that gets an item of ours. The item is a copy of one of the
 * menu's own items, so it looks and behaves like the rest.
 */
export interface MenuSpec {
  /** A short name, such as "profile". */
  readonly id: string;
  /** An open menu, such as `[role=menu]`. */
  readonly menu: Selector;
  /** The button that opens it. If given, only the menu it controls counts. */
  readonly trigger?: Selector;
  /** The native item to copy, inside the menu. */
  readonly template: Selector;
  /** Our item goes right after this one. Defaults to the template. */
  readonly after?: Selector;
}

/**
 * The cover over a past chat. Its look comes from the site at runtime: CSS
 * custom properties where the site has them, and computed styles otherwise.
 */
export interface CoverSpec {
  /** The chat area to cover: thread and composer, not the sidebar. */
  readonly target: Selector;
  /** Where "New chat" goes, such as "/" or "/new". */
  readonly newChatHref: string;
  readonly theme?: CoverTheme;
}

/** The site's own design tokens, as CSS custom property names. */
export interface CoverTheme {
  readonly surface?: string;
  readonly text?: string;
  readonly muted?: string;
  readonly border?: string;
  /** An element whose font the cover copies, when `<body>`'s isn't the UI font. */
  readonly fontFrom?: Selector;
  /** An element whose font the heading copies, such as a greeting. */
  readonly headingFontFrom?: Selector;
}

export interface Anchor {
  /** A short name shown in diagnostics, such as "sidebar". */
  readonly id: string;
  readonly selector: Selector;
  /** Only expected on paths that match. Expected everywhere if left out. */
  readonly on?: RegExp;
}

/** Declares a site. It's an identity function that gives the definition its type. */
export function defineSite(definition: SiteDefinition): SiteDefinition {
  return definition;
}

function captureGroups(pattern: RegExp): number {
  // Matching the empty alternative reveals how many groups the pattern has.
  return (new RegExp(`${pattern.source}|`).exec("")?.length ?? 1) - 1;
}

function surfaceSelectors(surface: Surface): Selector[] {
  switch (surface.kind) {
    case "filter":
      return surface.chats
        ? [surface.item, surface.chats.item]
        : [surface.item];
    case "remove":
      return [surface.match];
    case "collapse-empty":
      return [surface.group];
  }
}

function idSourceProblems(where: string, source: IdSource): string[] {
  const pattern = "href" in source ? source.href : source.match;
  if (pattern && captureGroups(pattern) < 1) {
    return [`${where}: the ID pattern needs a capture group for the ID`];
  }
  if (
    "attribute" in source &&
    selectorProblems(`[${source.attribute}]`).length > 0
  ) {
    return [
      `${where}: reads the "${source.attribute}" attribute, which isn't a stable hook`,
    ];
  }
  return [];
}

/**
 * Lists what's wrong with a site definition. Every registered site is checked
 * in tests, so a bad selector fails CI instead of breaking a site for users.
 */
export function siteProblems(site: SiteDefinition): string[] {
  const problems: string[] = [];

  if (site.hosts.length === 0) problems.push("has no hosts");
  for (const host of site.hosts) {
    if (!/^[a-z0-9.-]+$/.test(host))
      problems.push(`host "${host}" isn't a host name`);
  }

  if (captureGroups(site.routes.chat) < 1) {
    problems.push("the chat route needs a capture group for the chat ID");
  }
  const { settings } = site.routes;
  if (settings) {
    if (captureGroups(settings.pattern) < 1) {
      problems.push("the settings route needs a capture group for the section");
    }
    const section = settings.pattern.exec(settings.fallback)?.[1];
    if (section === undefined || !settings.allowed.includes(section)) {
      problems.push("the settings fallback isn't an allowed section");
    }
  }

  const ids = new Set<string>();
  for (const surface of site.surfaces) {
    const where = `surface "${surface.id}"`;
    if (ids.has(surface.id)) problems.push(`${where} is defined twice`);
    ids.add(surface.id);
    for (const selector of surfaceSelectors(surface)) {
      for (const problem of selectorProblems(selector)) {
        problems.push(`${where}: "${selector}" ${problem}`);
      }
    }
    if (surface.kind === "filter") {
      problems.push(...idSourceProblems(where, surface.idFrom));
      if (surface.chats)
        problems.push(...idSourceProblems(where, surface.chats.idFrom));
    }
  }

  const anchorIds = new Set<string>();
  for (const anchor of site.anchors ?? []) {
    const where = `anchor "${anchor.id}"`;
    if (anchorIds.has(anchor.id)) problems.push(`${where} is defined twice`);
    anchorIds.add(anchor.id);
    for (const problem of selectorProblems(anchor.selector)) {
      problems.push(`${where}: "${anchor.selector}" ${problem}`);
    }
  }

  if (site.cover) problems.push(...coverProblems(site.cover));

  const menuIds = new Set<string>();
  for (const menu of site.menus ?? []) {
    const where = `menu "${menu.id}"`;
    if (menuIds.has(menu.id)) problems.push(`${where} is defined twice`);
    menuIds.add(menu.id);
    const selectors = [menu.menu, menu.trigger, menu.template, menu.after];
    for (const selector of selectors) {
      if (selector === undefined) continue;
      for (const problem of selectorProblems(selector)) {
        problems.push(`${where}: "${selector}" ${problem}`);
      }
    }
  }

  return problems;
}

function coverProblems(cover: CoverSpec): string[] {
  const problems: string[] = [];
  const selectors = [
    cover.target,
    cover.theme?.fontFrom,
    cover.theme?.headingFontFrom,
  ].filter((selector) => selector !== undefined);
  for (const selector of selectors) {
    for (const problem of selectorProblems(selector)) {
      problems.push(`cover: "${selector}" ${problem}`);
    }
  }
  if (!cover.newChatHref.startsWith("/")) {
    problems.push("cover: the new-chat link must be a path on the site");
  }
  const { surface, text, muted, border } = cover.theme ?? {};
  for (const name of [surface, text, muted, border]) {
    if (name !== undefined && !/^--[\w-]+$/.test(name)) {
      problems.push(`cover: "${name}" isn't a CSS custom property`);
    }
  }
  return problems;
}
