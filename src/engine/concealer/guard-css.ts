import type { SiteDefinition, Selector } from "../site/definition";

/**
 * The guard stylesheet: hide with CSS, reveal with JavaScript.
 *
 * While Guest mode is on, or before we know whether it is, every item a site
 * lists is hidden unless the engine has marked it `data-curtain-ok`. The CSS
 * is in place before the page paints, and JavaScript only ever adds the mark.
 * So if our script fails, content stays hidden; it never leaks.
 */

/** The attribute on `<html>` that holds the current mode. */
export const MODE_ATTRIBUTE = "data-curtain";
/** The attribute the engine adds to items that may be shown. */
export const OK_ATTRIBUTE = "data-curtain-ok";
/** Set on `<html>` while the page shows past content, such as an old chat. */
export const PAST_ATTRIBUTE = "data-curtain-past";
/** Marks the cover element, which stays visible over hidden content. */
export const COVER_ATTRIBUTE = "data-curtain-cover";

/** Matches the page whenever hiding applies: Guest mode on, or not known yet. */
const ACTIVE = `:where(:root[${MODE_ATTRIBUTE}="guest"], :root[${MODE_ATTRIBUTE}="pending"])`;

const HIDE = "{ display: none !important; }";

/** Hidden until the engine marks them as allowed. */
function hiddenUntilAllowed(site: SiteDefinition): Selector[] {
  return site.surfaces.flatMap((surface) => {
    switch (surface.kind) {
      case "filter":
        return surface.chats
          ? [surface.item, surface.chats.item]
          : [surface.item];
      case "collapse-empty":
        return [surface.group];
      case "remove":
        return [];
    }
  });
}

/** Never shown while hiding applies. */
function alwaysHidden(site: SiteDefinition): Selector[] {
  return site.surfaces.flatMap((surface) =>
    surface.kind === "remove" ? [surface.match] : [],
  );
}

/**
 * Splits a selector list on its top-level commas, leaving commas inside
 * brackets, parentheses and quotes alone.
 */
export function splitSelectorList(list: Selector): Selector[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const char = list.charAt(i);
    if (quote !== null) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "[" || char === "(") {
      depth++;
    } else if (char === "]" || char === ")") {
      depth--;
    } else if (char === "," && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(list.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** One rule per selector in the list, each scoped to the active page. */
function rule(list: Selector, suffix: string): string {
  const selectors = splitSelectorList(list).map(
    (selector) => `${ACTIVE} ${selector}${suffix}`,
  );
  return `${selectors.join(", ")} ${HIDE}`;
}

/**
 * While a past chat is shown, everything in the chat area except the cover is
 * hidden from sight and from screen readers. Every descendant is matched, so
 * nothing inside can opt back in with its own `visibility`. Visibility, not
 * display, keeps the site's layout intact underneath.
 */
function coverRule(site: SiteDefinition): string[] {
  if (!site.cover) return [];
  const selectors = splitSelectorList(site.cover.target).map(
    (target) =>
      `${ACTIVE}[${PAST_ATTRIBUTE}] ${target} :not([${COVER_ATTRIBUTE}], [${COVER_ATTRIBUTE}] *)`,
  );
  return [`${selectors.join(", ")} { visibility: hidden !important; }`];
}

export function guardCss(site: SiteDefinition): string {
  return [
    ...hiddenUntilAllowed(site).map((list) =>
      rule(list, `:not([${OK_ATTRIBUTE}])`),
    ),
    ...alwaysHidden(site).map((list) => rule(list, "")),
    ...coverRule(site),
  ].join("\n");
}
