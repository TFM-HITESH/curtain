import { plausibleIdTime, type IsVisible } from "@/core";
import type { SiteDefinition } from "../site/definition";

/**
 * Whether the page in a tab shows past content: a chat from outside the
 * session, or a page that's never shown in Guest mode. Such a page gets a
 * neutral tab title and the cover.
 *
 * `isVisible` is `null` while Guest mode's state isn't known yet. A chat page
 * counts as past content until it is, so nothing shows early.
 */
export function showsPastContent(
  site: SiteDefinition,
  path: string,
  isVisible: IsVisible | null,
  now: number,
): boolean {
  if (site.routes.blocked?.some((pattern) => pattern.test(path))) return true;

  const chatId = site.routes.chat.exec(path)?.[1];
  if (!chatId) return false;
  if (isVisible === null) return true;

  const createdAt = site.idTime
    ? plausibleIdTime(site.idTime, chatId, now)
    : null;
  return !isVisible({ kind: "chat", id: chatId, createdAt });
}
