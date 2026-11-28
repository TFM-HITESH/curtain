import {
  plausibleIdTime,
  type ChatItem,
  type IsVisible,
  type VisibilityItem,
} from "@/core";
import { conceal, reveal } from "../concealer/concealer";
import { OK_ATTRIBUTE } from "../concealer/guard-css";
import type {
  IdSource,
  ItemKind,
  Selector,
  SiteDefinition,
} from "../site/definition";
import { readId } from "./read-id";

/**
 * Decides, item by item, what to reveal as a site renders its lists.
 *
 * The guard stylesheet hides everything listed; this marks the items that may
 * show. It only looks at what changed: nodes that were added, and ID
 * attributes that changed on rows a list reuses for different chats. The work
 * is batched once per frame and split across frames on very long lists.
 */

/** A kind of element the watcher decides about. */
interface Target {
  readonly selector: Selector;
  readonly kind: ItemKind;
  readonly idFrom: IdSource;
  /** For projects: the chats inside. */
  readonly chats?: { readonly selector: Selector; readonly idFrom: IdSource };
}

export interface ListWatcherOptions {
  readonly doc?: Document;
  readonly now?: () => number;
  /** Runs the next batch. Defaults to the next animation frame. */
  readonly schedule?: (callback: () => void) => void;
  /** How long one batch may run before the rest waits for the next frame. */
  readonly budgetMs?: number;
}

export interface ListWatcher {
  /**
   * Starts watching with the given rules, or switches to new ones. Every item
   * already on the page is decided again before this returns.
   */
  start(isVisible: IsVisible): void;
  /** Stops watching. */
  stop(): void;
  /** Decides everything waiting now, instead of on the next frame. */
  flush(): void;
}

function targetsOf(site: SiteDefinition): Target[] {
  return site.surfaces.flatMap((surface): Target[] => {
    if (surface.kind !== "filter") return [];
    const target: Target = {
      selector: surface.item,
      kind: surface.itemKind,
      idFrom: surface.idFrom,
      ...(surface.chats && {
        chats: { selector: surface.chats.item, idFrom: surface.chats.idFrom },
      }),
    };
    // Chats inside a project are decided one by one, like any other chat.
    return surface.chats
      ? [
          target,
          {
            selector: surface.chats.item,
            kind: "chat",
            idFrom: surface.chats.idFrom,
          },
        ]
      : [target];
  });
}

function attributesOf(targets: readonly Target[]): string[] {
  const names = new Set(["href"]);
  for (const target of targets) {
    if ("attribute" in target.idFrom) names.add(target.idFrom.attribute);
  }
  return [...names];
}

export function createListWatcher(
  site: SiteDefinition,
  {
    doc = document,
    now = Date.now,
    schedule = (callback) => requestAnimationFrame(callback),
    budgetMs = 8,
  }: ListWatcherOptions = {},
): ListWatcher {
  const targets = targetsOf(site);
  const itemSelector = targets.map((target) => target.selector).join(", ");
  const groupSelector = site.surfaces
    .flatMap((surface) =>
      surface.kind === "collapse-empty" ? [surface.group] : [],
    )
    .join(", ");

  let isVisible: IsVisible | null = null;
  let scheduled = false;
  const pending = new Set<Element>();

  function createdAt(id: string): number | null {
    return site.idTime ? plausibleIdTime(site.idTime, id, now()) : null;
  }

  function chatsIn(element: Element, target: Target): ChatItem[] {
    if (!target.chats) return [];
    const { selector, idFrom } = target.chats;
    return [...element.querySelectorAll(selector)].flatMap(
      (chat): ChatItem[] => {
        const id = readId(chat, idFrom);
        return id === null
          ? []
          : [{ kind: "chat", id, createdAt: createdAt(id) }];
      },
    );
  }

  function itemFor(element: Element, target: Target): VisibilityItem | null {
    const id = readId(element, target.idFrom);
    if (id === null) return null;
    const time = createdAt(id);
    return target.kind === "project"
      ? {
          kind: "project",
          id,
          createdAt: time,
          chats: chatsIn(element, target),
        }
      : { kind: target.kind, id, createdAt: time };
  }

  function decide(element: Element, rules: IsVisible) {
    const target = targets.find((candidate) =>
      element.matches(candidate.selector),
    );
    const item = target ? itemFor(element, target) : null;
    if (item !== null && rules(item)) reveal(element);
    else conceal(element);
  }

  function decideGroup(group: Element) {
    const hasVisibleItem = [...group.querySelectorAll(itemSelector)].some(
      (item) => item.hasAttribute(OK_ATTRIBUTE),
    );
    if (hasVisibleItem) reveal(group);
    else conceal(group);
  }

  /** Queues every item in or around a changed node. */
  function collect(node: Node) {
    if (!(node instanceof Element) || itemSelector === "") return;
    const owner = node.closest(itemSelector);
    if (owner) pending.add(owner);
    for (const item of node.querySelectorAll(itemSelector)) pending.add(item);
    // A chat appearing inside a project can change whether the project shows.
    for (const target of targets) {
      if (target.kind === "project") {
        const project = node.closest(target.selector);
        if (project) pending.add(project);
      }
    }
  }

  function process() {
    scheduled = false;
    const rules = isVisible;
    if (rules === null) return;
    const started = performance.now();
    const groups = new Set<Element>();
    for (const element of pending) {
      pending.delete(element);
      decide(element, rules);
      const group =
        groupSelector === "" ? null : element.closest(groupSelector);
      if (group) groups.add(group);
      if (performance.now() - started > budgetMs) break;
    }
    for (const group of groups) decideGroup(group);
    if (pending.size > 0) request();
  }

  function request() {
    if (scheduled) return;
    scheduled = true;
    schedule(process);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") collect(record.target);
      for (const node of record.addedNodes) collect(node);
    }
    if (pending.size > 0) request();
  });

  return {
    start(rules) {
      const wasRunning = isVisible !== null;
      isVisible = rules;
      // Decide everything on the page now, so nothing waits a frame.
      pending.clear();
      if (itemSelector !== "") {
        for (const item of doc.querySelectorAll(itemSelector))
          decide(item, rules);
      }
      if (groupSelector !== "") {
        for (const group of doc.querySelectorAll(groupSelector))
          decideGroup(group);
      }
      if (!wasRunning) {
        observer.observe(doc.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: attributesOf(targets),
        });
      }
    },
    stop() {
      observer.disconnect();
      isVisible = null;
      pending.clear();
    },
    flush() {
      while (pending.size > 0 && isVisible !== null) process();
    },
  };
}
