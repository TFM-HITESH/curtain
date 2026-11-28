import type { NavigationKind, RouteChange } from "./created-chat";

/**
 * Reports route changes inside a single-page app.
 *
 * Uses the Navigation API where the browser has it, since it says how each
 * change happened. Elsewhere it falls back to `popstate` for back and forward
 * and a light URL check for everything else, treated as a push.
 */

export interface WatchNavigationOptions {
  readonly win?: Window;
  /** How often the fallback checks the URL. */
  readonly pollMs?: number;
}

export function watchNavigation(
  listener: (change: RouteChange) => void,
  { win = window, pollMs = 250 }: WatchNavigationOptions = {},
): () => void {
  let current = win.location.pathname;

  function report(kind: NavigationKind) {
    const to = win.location.pathname;
    if (to === current) return;
    const from = current;
    current = to;
    listener({ from, to, kind });
  }

  // Not every browser has the Navigation API, whatever the DOM types say.
  const { navigation } = win as Partial<Pick<Window, "navigation">>;
  if (navigation) {
    const onChange = (event: NavigationCurrentEntryChangeEvent) => {
      report(event.navigationType ?? "replace");
    };
    navigation.addEventListener("currententrychange", onChange);
    return () => {
      navigation.removeEventListener("currententrychange", onChange);
    };
  }

  const onPopState = () => {
    report("traverse");
  };
  win.addEventListener("popstate", onPopState);
  const timer = win.setInterval(() => {
    report("push");
  }, pollMs);
  return () => {
    win.removeEventListener("popstate", onPopState);
    win.clearInterval(timer);
  };
}
