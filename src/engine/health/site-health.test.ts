// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineSite } from "../site/definition";
import { checkHealthLater, missingAnchors } from "./site-health";

const site = defineSite({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  title: "ChatGPT",
  routes: { newChat: /^\/$/, chat: /^\/c\/([^/]+)/ },
  surfaces: [],
  anchors: [
    { id: "sidebar", selector: "nav[data-sidebar]" },
    { id: "composer", selector: "[data-composer]", on: /^\/(c\/.*)?$/ },
  ],
});

beforeEach(() => {
  document.body.innerHTML = "<nav data-sidebar></nav>";
});

describe("missingAnchors", () => {
  it("lists anchors that can't be found", () => {
    expect(missingAnchors(site, document, "/c/abc")).toEqual(["composer"]);
  });

  it("only expects an anchor on its own paths", () => {
    expect(missingAnchors(site, document, "/settings/general")).toEqual([]);
  });

  it("is empty when everything is there", () => {
    document.body.insertAdjacentHTML("beforeend", "<div data-composer></div>");
    expect(missingAnchors(site, document, "/")).toEqual([]);
  });

  it("is empty for a site without anchors", () => {
    const bare = defineSite({
      id: "claude",
      hosts: ["claude.ai"],
      title: "Claude",
      routes: site.routes,
      surfaces: [],
    });
    expect(missingAnchors(bare, document, "/")).toEqual([]);
  });
});

describe("checkHealthLater", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks once, after the delay", () => {
    const onResult = vi.fn();
    checkHealthLater(site, onResult, { delayMs: 5000, path: () => "/" });
    vi.advanceTimersByTime(4999);
    expect(onResult).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onResult).toHaveBeenCalledWith(["composer"]);
  });

  it("can be cancelled", () => {
    const onResult = vi.fn();
    const cancel = checkHealthLater(site, onResult, { delayMs: 100 });
    cancel();
    vi.advanceTimersByTime(1000);
    expect(onResult).not.toHaveBeenCalled();
  });

  it("uses the page's own path by default", () => {
    const onResult = vi.fn();
    checkHealthLater(site, onResult);
    vi.advanceTimersByTime(10_000);
    expect(onResult).toHaveBeenCalledOnce();
  });
});
