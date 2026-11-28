import type { GuestState, SiteId, StorageState } from "../state/schema";
import { createdInSession } from "../time/skew";

/**
 * The one question the whole extension depends on: should this be visible
 * right now?
 *
 * Anything that can't be placed in the current session stays hidden. That's
 * the rule we never bend, so every input that's missing or unknown counts
 * against visibility, never for it.
 */

interface BaseItem {
  readonly id: string;
  /**
   * Server creation time in epoch milliseconds, from the ID or the site's own
   * data, or `null` when unknown. Callers pass only plausible times.
   */
  readonly createdAt: number | null;
}

export interface ChatItem extends BaseItem {
  readonly kind: "chat";
}

/** A container, such as a project or a notebook. */
export interface ProjectItem extends BaseItem {
  readonly kind: "project";
  /** The chats inside it that the page knows about. */
  readonly chats: readonly ChatItem[];
}

/** Anything else that lists past content, such as a library file. */
export interface OtherItem extends BaseItem {
  readonly kind: "item";
}

export type VisibilityItem = ChatItem | ProjectItem | OtherItem;

export type IsVisible = (item: VisibilityItem) => boolean;

const SHOW_EVERYTHING: IsVisible = () => true;

/**
 * Builds the rule for one site from the current state. Lookups are prepared
 * once, so checking each item in a long list stays cheap.
 */
export function visibilityRules(
  state: Pick<StorageState, "guest" | "marks">,
  site: SiteId,
): IsVisible {
  const { guest } = state;
  if (guest === null) return SHOW_EVERYTHING;

  const session = guest.session[site];
  const chats = new Set([
    ...session.chats,
    ...session.revealed,
    ...state.marks[site],
  ]);
  const projects = new Set(session.projects);
  const items = new Set(session.items);
  const isNew = (createdAt: number | null) =>
    isCreatedInSession(createdAt, guest);

  const isChatVisible = (chat: ChatItem) =>
    chats.has(chat.id) || isNew(chat.createdAt);

  return (item) => {
    switch (item.kind) {
      case "chat":
        return isChatVisible(item);
      case "project":
        return (
          projects.has(item.id) ||
          isNew(item.createdAt) ||
          item.chats.some(isChatVisible)
        );
      case "item":
        return items.has(item.id) || isNew(item.createdAt);
    }
  };
}

function isCreatedInSession(
  createdAt: number | null,
  guest: GuestState,
): boolean {
  return (
    createdAt !== null &&
    createdInSession(createdAt, guest.startedAt, guest.skewMs)
  );
}
