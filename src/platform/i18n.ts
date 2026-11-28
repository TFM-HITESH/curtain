import { browser } from "wxt/browser";

/**
 * Translated text from the extension's message files.
 *
 * Keys are typed from `public/_locales/en/messages.json`, so a missing key is a
 * type error rather than blank text at runtime.
 */

export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

export function t(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions) || key;
}
