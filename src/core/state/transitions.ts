import { measureSkew } from "../time/skew";
import {
  SITE_IDS,
  createGuestState,
  type GuestState,
  type Marks,
  type SessionSets,
  type SiteId,
} from "./schema";

/**
 * Pure state changes. The background worker applies these and writes the
 * result; nothing here touches storage.
 */

export function isSiteId(value: unknown): value is SiteId {
  return SITE_IDS.includes(value as SiteId);
}

/** Session sets that can grow while Guest mode is on. */
export type SessionKind = Exclude<keyof SessionSets, "revealed">;

function addIds(
  existing: readonly string[],
  ids: readonly string[],
): readonly string[] {
  const merged = new Set(existing);
  for (const id of ids) merged.add(id);
  return merged.size === existing.length ? existing : [...merged];
}

function updateSite(
  guest: GuestState,
  site: SiteId,
  update: (sets: SessionSets) => SessionSets,
): GuestState {
  return {
    ...guest,
    session: { ...guest.session, [site]: update(guest.session[site]) },
  };
}

/**
 * Starts a session. The chat open in the tab where Guest mode was turned on,
 * if any, belongs to the session from the start.
 */
export function startSession(
  now: number,
  openChat?: { readonly site: SiteId; readonly chatId: string },
): GuestState {
  const guest = createGuestState(now);
  return openChat
    ? addToSession(guest, openChat.site, "chats", [openChat.chatId])
    : guest;
}

export function addToSession(
  guest: GuestState,
  site: SiteId,
  kind: SessionKind,
  ids: readonly string[],
): GuestState {
  return updateSite(guest, site, (sets) => ({
    ...sets,
    [kind]: addIds(sets[kind], ids),
  }));
}

/**
 * Records a chat seen being created during the session. If the site's IDs
 * carry a creation time and the clock difference isn't known yet, this is the
 * moment to measure it.
 */
export function recordCreatedChat(
  guest: GuestState,
  site: SiteId,
  chatId: string,
  serverTime: number | null,
  now: number,
): GuestState {
  const withChat = addToSession(guest, site, "chats", [chatId]);
  if (guest.skewMs !== null || serverTime === null) return withChat;
  const skewMs = measureSkew(serverTime, now);
  return skewMs === null ? withChat : { ...withChat, skewMs };
}

/** Shows one chat for the rest of the session, after the PIN was entered. */
export function revealChat(
  guest: GuestState,
  site: SiteId,
  chatId: string,
): GuestState {
  return updateSite(guest, site, (sets) => ({
    ...sets,
    revealed: addIds(sets.revealed, [chatId]),
  }));
}

export function setMark(
  marks: Marks,
  site: SiteId,
  chatId: string,
  marked: boolean,
): Marks {
  const current = marks[site];
  const next = marked
    ? addIds(current, [chatId])
    : current.filter((id) => id !== chatId);
  return { ...marks, [site]: next };
}

/** Clears the marks for one site, or for every site. */
export function clearMarks(marks: Marks, site?: SiteId): Marks {
  if (site) return { ...marks, [site]: [] };
  return { chatgpt: [], claude: [], gemini: [] };
}
