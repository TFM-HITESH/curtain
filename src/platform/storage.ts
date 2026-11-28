import {
  STORAGE_KEYS,
  normalizeState,
  normalizeValue,
  type StorageKey,
  type StorageState,
} from "@/core";
import { browser } from "wxt/browser";

/**
 * Typed access to Curtain's state in `storage.local`.
 *
 * Everything read is normalized, so callers always get well-formed state no
 * matter what's stored. Only the background worker writes; everyone else reads
 * and listens for changes.
 */

export type StateChanges = { readonly [K in StorageKey]?: StorageState[K] };

/** Reads every key as stored, without normalizing. Used for migrations. */
export async function readRawState(): Promise<Record<string, unknown>> {
  return browser.storage.local.get([...STORAGE_KEYS]);
}

export async function readState(
  now: number = Date.now(),
): Promise<StorageState> {
  return normalizeState(await readRawState(), now);
}

/** Writes the given keys. Only the background worker should call this. */
export async function writeState(values: Partial<StorageState>): Promise<void> {
  await browser.storage.local.set(values);
}

/**
 * Calls `listener` with the normalized new values whenever any of Curtain's
 * keys change. Returns a function that stops listening.
 */
export function onStateChanged(
  listener: (changes: StateChanges) => void,
  now: () => number = Date.now,
): () => void {
  const handler = (changes: Record<string, { newValue?: unknown }>) => {
    const result: Partial<Record<StorageKey, unknown>> = {};
    for (const key of STORAGE_KEYS) {
      const change = changes[key];
      if (change) result[key] = normalizeValue(key, change.newValue, now());
    }
    if (Object.keys(result).length > 0) listener(result as StateChanges);
  };
  browser.storage.local.onChanged.addListener(handler);
  return () => {
    browser.storage.local.onChanged.removeListener(handler);
  };
}
