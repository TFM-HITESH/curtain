import {
  COVER_ATTRIBUTE,
  PAST_ATTRIBUTE,
  resolveTheme,
  type CoverSpec,
} from "@/engine";
import type { CoverText } from "../strings";
import { coverCss } from "./cover-css";

/**
 * The cover over a past chat: the only overlay Curtain ever shows.
 *
 * The guard stylesheet hides the chat area underneath as soon as the page is
 * marked as showing past content, before the cover itself even exists. The
 * cover then adds a calm, site-styled message with a way out. Sites re-render
 * their chat area as they load, so the cover moves to the current one.
 */

export interface CoverOptions {
  readonly spec: CoverSpec;
  readonly text: CoverText;
  readonly onNewChat: () => void;
  readonly onExit: () => void;
  /** Shows "Show this chat". Only offered when a PIN is set. */
  readonly onReveal?: () => void;
  readonly doc?: Document;
}

export interface Cover {
  show(): void;
  hide(): void;
  readonly shown: boolean;
}

const LOCK_PATH =
  "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z";

export function createCover({
  spec,
  text,
  onNewChat,
  onExit,
  onReveal,
  doc = document,
}: CoverOptions): Cover {
  let element: HTMLElement | null = null;
  let style: HTMLStyleElement | null = null;
  let observer: MutationObserver | null = null;
  /** A chat area we made positioned, to undo on hide. */
  let positioned: HTMLElement | null = null;

  function button(label: string, onClick: () => void, kind?: string) {
    const node = doc.createElement("button");
    node.type = "button";
    node.textContent = label;
    if (kind) node.setAttribute(kind, "");
    node.addEventListener("click", onClick);
    return node;
  }

  function build(): HTMLElement {
    const root = doc.createElement("div");
    root.setAttribute(COVER_ATTRIBUTE, "");
    root.setAttribute("role", "region");
    root.setAttribute("aria-labelledby", "curtain-cover-heading");

    const panel = doc.createElement("div");
    panel.setAttribute("data-curtain-cover-panel", "");

    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-curtain-cover-icon", "");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", LOCK_PATH);
    svg.append(path);

    const heading = doc.createElement("h2");
    heading.id = "curtain-cover-heading";
    heading.setAttribute("data-curtain-cover-heading", "");
    heading.textContent = text.heading;

    const body = doc.createElement("p");
    body.setAttribute("data-curtain-cover-body", "");
    body.textContent = text.body;

    const actions = doc.createElement("div");
    actions.setAttribute("data-curtain-cover-actions", "");
    actions.append(
      button(text.newChat, onNewChat, "data-curtain-primary"),
      button(text.exit, onExit),
    );

    panel.append(svg, heading, body, actions);
    if (onReveal)
      panel.append(button(text.reveal, onReveal, "data-curtain-link"));
    root.append(panel);
    return root;
  }

  function restorePosition() {
    if (positioned) positioned.style.removeProperty("position");
    positioned = null;
  }

  /** Puts the cover in the current chat area, if there is one. */
  function place() {
    if (!element) return;
    const target = doc.querySelector<HTMLElement>(spec.target);
    if (!target || element.parentElement === target) return;
    // The look is read once the page has rendered enough to read it from.
    if (!style) {
      style = doc.createElement("style");
      style.setAttribute("data-curtain-cover-style", "");
      style.textContent = coverCss(resolveTheme(doc, spec.theme));
      doc.documentElement.append(style);
    }
    restorePosition();
    const position = doc.defaultView?.getComputedStyle(target).position;
    // An empty value means the default, which is static.
    if (position === "static" || position === "") {
      target.style.setProperty("position", "relative");
      positioned = target;
    }
    target.append(element);
  }

  return {
    show() {
      doc.documentElement.setAttribute(PAST_ATTRIBUTE, "");
      if (element) return;
      element = build();
      place();
      observer = new MutationObserver(place);
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    },
    hide() {
      doc.documentElement.removeAttribute(PAST_ATTRIBUTE);
      observer?.disconnect();
      observer = null;
      element?.remove();
      element = null;
      style?.remove();
      style = null;
      restorePosition();
    },
    get shown() {
      return element !== null;
    },
  };
}
