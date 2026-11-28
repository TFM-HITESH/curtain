import type { CoverTheme } from "../site/definition";

/**
 * Taking Curtain's look from the site.
 *
 * Where a site has design tokens, the CSS uses them directly, so the browser
 * keeps up with theme changes on its own. Each token gets a fallback read from
 * the live page, so a renamed token degrades to a close match instead of
 * breaking the look.
 */

export interface ResolvedTheme {
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  readonly font: string;
  readonly headingFont: string;
}

function isTransparent(color: string): boolean {
  return (
    color === "" ||
    color === "transparent" ||
    /^rgba\(.*,\s*0\)$/.test(color.replace(/\s+/g, " "))
  );
}

/** The first solid background from `<body>` up to `<html>`. */
function pageBackground(doc: Document, view: Window): string {
  for (const element of [doc.body, doc.documentElement]) {
    const color = view.getComputedStyle(element).backgroundColor;
    if (!isTransparent(color)) return color;
  }
  return "Canvas";
}

function fontOf(doc: Document, view: Window, selector?: string): string {
  const element =
    (selector === undefined ? null : doc.querySelector(selector)) ?? doc.body;
  return view.getComputedStyle(element).fontFamily || "system-ui, sans-serif";
}

function token(name: string | undefined, fallback: string): string {
  return name === undefined ? fallback : `var(${name}, ${fallback})`;
}

export function resolveTheme(
  doc: Document,
  theme: CoverTheme = {},
): ResolvedTheme {
  const view = doc.defaultView ?? window;
  const surface = token(theme.surface, pageBackground(doc, view));
  const text = token(
    theme.text,
    view.getComputedStyle(doc.body).color || "CanvasText",
  );
  const font = fontOf(doc, view, theme.fontFrom);
  return {
    surface,
    text,
    muted: token(theme.muted, `color-mix(in srgb, ${text} 68%, ${surface})`),
    border: token(theme.border, `color-mix(in srgb, ${text} 16%, ${surface})`),
    font,
    headingFont:
      theme.headingFontFrom === undefined
        ? font
        : fontOf(doc, view, theme.headingFontFrom),
  };
}
