import type { IdSource } from "../site/definition";

/**
 * Reads an item's ID as its site definition describes. Returns `null` when the
 * ID can't be read, and an item without an ID is never shown.
 */
export function readId(element: Element, source: IdSource): string | null {
  if ("attribute" in source) {
    const value = element.getAttribute(source.attribute);
    if (!value) return null;
    if (!source.match) return value;
    return source.match.exec(value)?.[1] ?? null;
  }
  const link = element.matches("a[href]")
    ? element
    : element.querySelector("a[href]");
  const href = link?.getAttribute("href");
  if (!href) return null;
  return source.href.exec(href)?.[1] ?? null;
}
