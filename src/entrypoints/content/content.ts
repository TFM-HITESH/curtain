import type { GuestState } from "@/core";
import {
  installConcealer,
  type Concealer,
  type SiteDefinition,
} from "@/engine";
import { onStateChanged, readState } from "@/platform";
import { siteForHost, sites } from "@/sites";

/**
 * The content script, started at `document_start` on supported sites.
 *
 * Hiding starts straight away, before Guest mode's state is known, and stays
 * in place if storage never answers.
 */

export interface ContentOptions {
  readonly hostname?: string;
  readonly doc?: Document;
  /** The sites to choose from. Only tests change this. */
  readonly registry?: readonly SiteDefinition[];
}

export interface Content {
  readonly concealer: Concealer;
  readonly stop: () => void;
}

export function startContent({
  hostname = location.hostname,
  doc = document,
  registry = sites,
}: ContentOptions = {}): Content | undefined {
  const site = siteForHost(hostname, registry);
  if (!site) return undefined;

  const concealer = installConcealer(site, doc);
  const apply = (guest: GuestState | null) => {
    concealer.setMode(guest === null ? "off" : "guest");
  };

  // A change event is always newer than the first read, so once one arrives
  // the first read's answer no longer matters.
  let changed = false;
  const stopListening = onStateChanged((changes) => {
    if (changes.guest === undefined) return;
    changed = true;
    apply(changes.guest);
  });
  readState().then(
    (state) => {
      if (!changed) apply(state.guest);
    },
    () => {
      // Without an answer the page stays hidden, which is the safe outcome.
    },
  );

  return {
    concealer,
    stop: () => {
      stopListening();
      concealer.stop();
    },
  };
}
