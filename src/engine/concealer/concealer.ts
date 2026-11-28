import type { SiteDefinition } from "../site/definition";
import { MODE_ATTRIBUTE, OK_ATTRIBUTE, guardCss } from "./guard-css";

/**
 * Puts the guard stylesheet in place and keeps it there.
 *
 * Installed at `document_start`, before the site renders anything. The mode
 * starts as `pending`, which hides like Guest mode, and switches once storage
 * answers. Sites rewrite `<html>` and `<head>` as they load, so the mode
 * attribute and the stylesheet are put back if anything removes them.
 */

export type Mode = "pending" | "guest" | "off";

export interface Concealer {
  readonly mode: Mode;
  setMode(mode: Mode): void;
  /** Removes the stylesheet and the mode. Only for teardown and tests. */
  stop(): void;
}

export function installConcealer(
  site: SiteDefinition,
  doc: Document = document,
): Concealer {
  const root = doc.documentElement;
  let mode: Mode = "pending";

  const style = doc.createElement("style");
  style.setAttribute("data-curtain-guard", "");
  style.textContent = guardCss(site);

  function apply() {
    if (root.getAttribute(MODE_ATTRIBUTE) !== mode) {
      root.setAttribute(MODE_ATTRIBUTE, mode);
    }
    if (!style.isConnected) root.append(style);
  }

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(root, {
    attributes: true,
    attributeFilter: [MODE_ATTRIBUTE],
    childList: true,
  });

  return {
    get mode() {
      return mode;
    },
    setMode(next) {
      mode = next;
      apply();
    },
    stop() {
      observer.disconnect();
      style.remove();
      root.removeAttribute(MODE_ATTRIBUTE);
    },
  };
}

/** Allows an item to show. The only way anything becomes visible. */
export function reveal(element: Element): void {
  element.setAttribute(OK_ATTRIBUTE, "");
}

/** Hides an item again, for example when it stops belonging to the session. */
export function conceal(element: Element): void {
  element.removeAttribute(OK_ATTRIBUTE);
}
