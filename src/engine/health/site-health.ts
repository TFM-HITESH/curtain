import type { SiteDefinition } from "../site/definition";

/**
 * Noticing, on this device only, when a site may have changed.
 *
 * A while after a page loads, every element the site definition relies on
 * should be there. Anything missing is reported by name, so the popup can say
 * that Guest mode may need an update. Nothing is sent anywhere.
 */

/** The anchors expected on `path` that can't be found. */
export function missingAnchors(
  site: SiteDefinition,
  doc: Document,
  path: string,
): string[] {
  return (site.anchors ?? [])
    .filter((anchor) => anchor.on?.test(path) ?? true)
    .filter((anchor) => doc.querySelector(anchor.selector) === null)
    .map((anchor) => anchor.id);
}

export interface HealthCheckOptions {
  readonly doc?: Document;
  /** How long after loading the page to look. */
  readonly delayMs?: number;
  readonly path?: () => string;
}

/** Checks the anchors once, after a delay. Returns a function that cancels it. */
export function checkHealthLater(
  site: SiteDefinition,
  onResult: (missing: string[]) => void,
  {
    doc = document,
    delayMs = 10_000,
    path = () => location.pathname,
  }: HealthCheckOptions = {},
): () => void {
  const timer = setTimeout(() => {
    onResult(missingAnchors(site, doc, path()));
  }, delayMs);
  return () => {
    clearTimeout(timer);
  };
}
