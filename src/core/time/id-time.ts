/**
 * Reading creation times out of IDs.
 *
 * Some sites put the creation time at the start of their IDs. That lets us
 * tell whether an item was created after Guest mode started, even if we never
 * saw it being created. A decoder only reads the format; `plausibleIdTime`
 * then rejects results that can't be real, so a change in a site's ID format
 * can't make old content look new.
 */

/** Reads a creation time (epoch milliseconds) from an ID, or `null`. */
export type IdTimeDecoder = (id: string) => number | null;

/** No supported site has IDs older than this. */
export const EARLIEST_ID_TIME = Date.UTC(2020, 0, 1);

/** How far ahead of the local clock an ID time may be before it's rejected. */
export const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

const UUID =
  /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHATGPT_PROJECT = /^g-p-([0-9a-f]{8})[0-9a-f]{24}$/i;

/**
 * ChatGPT chat IDs (`/c/<uuid>`) and project IDs (`g-p-<32 hex>`) both start
 * with the creation time as 8 hex digits of Unix seconds.
 */
export const decodeChatGptIdTime: IdTimeDecoder = (id) => {
  const hex = UUID.exec(id)?.[1] ?? CHATGPT_PROJECT.exec(id)?.[1];
  return hex === undefined ? null : Number.parseInt(hex, 16) * 1000;
};

/**
 * UUID version 7 (used for Claude project IDs) starts with a 48-bit Unix
 * timestamp in milliseconds. Other UUID versions carry no usable time.
 */
export const decodeUuidV7Time: IdTimeDecoder = (id) => {
  // Layout: tttttttt-tttt-7xxx-xxxx-xxxxxxxxxxxx, where t is the timestamp.
  if (!UUID.test(id) || id[14] !== "7") return null;
  return Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
};

/** Decodes an ID's creation time and keeps it only if it could be real. */
export function plausibleIdTime(
  decode: IdTimeDecoder,
  id: string,
  now: number,
): number | null {
  const time = decode(id);
  if (time === null || time < EARLIEST_ID_TIME || time > now + MAX_FUTURE_MS) {
    return null;
  }
  return time;
}
