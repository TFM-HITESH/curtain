import {
  emptyMarks,
  visibilityRules,
  type GuestState,
  type Marks,
} from "@/core";
import {
  createListWatcher,
  installConcealer,
  type Concealer,
  type ListWatcherOptions,
  type SiteDefinition,
} from "@/engine";
import { onStateChanged, readState } from "@/platform";
import { siteForHost, sites } from "@/sites";

/**
 * The content script, started at `document_start` on supported sites.
 *
 * Hiding starts straight away, before Guest mode's state is known, and stays
 * in place if storage never answers. Once Guest mode is known to be on, the
 * list watcher reveals what belongs to the session.
 */

export interface ContentOptions {
  readonly hostname?: string;
  readonly doc?: Document;
  /** The sites to choose from. Only tests change this. */
  readonly registry?: readonly SiteDefinition[];
  /** Only tests change these. */
  readonly watcher?: ListWatcherOptions;
}

export interface Content {
  readonly concealer: Concealer;
  readonly stop: () => void;
}

export function startContent({
  hostname = location.hostname,
  doc = document,
  registry = sites,
  watcher: watcherOptions = {},
}: ContentOptions = {}): Content | undefined {
  const site = siteForHost(hostname, registry);
  if (!site) return undefined;

  const siteId = site.id;
  const concealer = installConcealer(site, doc);
  const watcher = createListWatcher(site, { doc, ...watcherOptions });

  // `undefined` means not known yet. Change events are always newer than the
  // first read, so the read only fills in what no event has told us.
  let guest: GuestState | null | undefined;
  let marks: Marks | undefined;

  function render() {
    if (guest === undefined) return;
    if (guest === null) {
      watcher.stop();
      concealer.setMode("off");
      return;
    }
    // Decide every item before hiding switches from pending to Guest mode,
    // so nothing from an earlier session is shown even for a moment.
    watcher.start(
      visibilityRules({ guest, marks: marks ?? emptyMarks() }, siteId),
    );
    concealer.setMode("guest");
  }

  const stopListening = onStateChanged((changes) => {
    if (changes.guest === undefined && changes.marks === undefined) return;
    if (changes.guest !== undefined) guest = changes.guest;
    if (changes.marks !== undefined) marks = changes.marks;
    render();
  });

  readState().then(
    (state) => {
      guest ??= state.guest;
      marks ??= state.marks;
      render();
    },
    () => {
      // Without an answer the page stays hidden, which is the safe outcome.
    },
  );

  return {
    concealer,
    stop: () => {
      stopListening();
      watcher.stop();
      concealer.stop();
    },
  };
}
