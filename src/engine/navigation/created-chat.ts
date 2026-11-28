import { plausibleIdTime } from "@/core";
import type { SiteDefinition } from "../site/definition";

/**
 * Spotting a chat at the moment it's created.
 *
 * Sending the first message on a site's new-chat screen moves the tab to the
 * new chat's page within the app. That move is the signal. Opening an old chat
 * any other way must never count: a page load (typed URL, bookmark, link from
 * elsewhere), going back or forward, or reloading.
 */

/** How the tab got to its current page. */
export type NavigationKind = "push" | "replace" | "traverse" | "reload";

export interface RouteChange {
  /** The path before the change. */
  readonly from: string;
  /** The path after the change. */
  readonly to: string;
  readonly kind: NavigationKind;
}

/** A chat whose creation time says it's older than this wasn't just created. */
export const MAX_NEW_CHAT_AGE_MS = 10 * 60 * 1000;

export interface CreatedChat {
  readonly chatId: string;
  /** Creation time read from the ID, if the site's IDs carry one. */
  readonly serverTime: number | null;
}

export function createdChat(
  site: SiteDefinition,
  change: RouteChange,
  now: number,
): CreatedChat | null {
  if (change.kind !== "push" && change.kind !== "replace") return null;
  if (!site.routes.newChat.test(change.from)) return null;

  const chatId = site.routes.chat.exec(change.to)?.[1];
  if (!chatId) return null;

  const serverTime = site.idTime
    ? plausibleIdTime(site.idTime, chatId, now)
    : null;
  // Where the ID says when the chat was made, an old one can't pass as new.
  // An ID that can't be read doesn't block the signal, so a change in a
  // site's ID format doesn't stop new chats from being recognised.
  if (serverTime !== null && serverTime < now - MAX_NEW_CHAT_AGE_MS)
    return null;

  return { chatId, serverTime };
}
