import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteChange } from "./created-chat";
import { watchNavigation } from "./watch-navigation";

/** A window with just enough of the Navigation API for these tests. */
function navigationWindow(pathname: string) {
  const location = { pathname };
  const navigation = new EventTarget();
  const go = (path: string, navigationType: string | null) => {
    location.pathname = path;
    navigation.dispatchEvent(
      Object.assign(new Event("currententrychange"), { navigationType }),
    );
  };
  return { win: { location, navigation } as unknown as Window, go, navigation };
}

/** A window without the Navigation API. */
function plainWindow(pathname: string) {
  const location = { pathname };
  const target = new EventTarget();
  const win = Object.assign(target, {
    location,
    setInterval: (callback: () => void, ms: number) =>
      setInterval(callback, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => {
      clearInterval(id);
    },
  }) as unknown as Window;
  return { win, location, target };
}

describe("watchNavigation with the Navigation API", () => {
  it("reports each change with how it happened", () => {
    const { win, go } = navigationWindow("/new");
    const changes: RouteChange[] = [];
    watchNavigation((change) => changes.push(change), { win });

    go("/chat/abc", "push");
    go("/chat/def", "traverse");
    go("/chat/ghi", "reload");
    expect(changes).toEqual([
      { from: "/new", to: "/chat/abc", kind: "push" },
      { from: "/chat/abc", to: "/chat/def", kind: "traverse" },
      { from: "/chat/def", to: "/chat/ghi", kind: "reload" },
    ]);
  });

  it("treats an unknown kind as a replace", () => {
    const { win, go } = navigationWindow("/new");
    const listener = vi.fn();
    watchNavigation(listener, { win });
    go("/chat/abc", null);
    expect(listener).toHaveBeenCalledWith({
      from: "/new",
      to: "/chat/abc",
      kind: "replace",
    });
  });

  it("ignores changes that keep the same path", () => {
    const { win, go } = navigationWindow("/new");
    const listener = vi.fn();
    watchNavigation(listener, { win });
    go("/new", "replace");
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops when asked", () => {
    const { win, go } = navigationWindow("/new");
    const listener = vi.fn();
    const stop = watchNavigation(listener, { win });
    stop();
    go("/chat/abc", "push");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("watchNavigation without the Navigation API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notices URL changes and treats them as pushes", () => {
    const { win, location } = plainWindow("/new");
    const listener = vi.fn();
    watchNavigation(listener, { win, pollMs: 100 });
    location.pathname = "/chat/abc";
    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledWith({
      from: "/new",
      to: "/chat/abc",
      kind: "push",
    });
  });

  it("reports back and forward as traversals", () => {
    const { win, location, target } = plainWindow("/chat/abc");
    const listener = vi.fn();
    watchNavigation(listener, { win });
    location.pathname = "/new";
    target.dispatchEvent(new Event("popstate"));
    expect(listener).toHaveBeenCalledWith({
      from: "/chat/abc",
      to: "/new",
      kind: "traverse",
    });
  });

  it("stops when asked", () => {
    const { win, location, target } = plainWindow("/new");
    const listener = vi.fn();
    const stop = watchNavigation(listener, { win, pollMs: 100 });
    stop();
    location.pathname = "/chat/abc";
    target.dispatchEvent(new Event("popstate"));
    vi.advanceTimersByTime(500);
    expect(listener).not.toHaveBeenCalled();
  });
});
