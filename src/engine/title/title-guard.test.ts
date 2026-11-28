// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTitleGuard as create, type TitleGuard } from "./title-guard";

const guards: TitleGuard[] = [];

/** Creates a guard that is released after the test. */
function createTitleGuard(): TitleGuard {
  const guard = create();
  guards.push(guard);
  return guard;
}

afterEach(() => {
  for (const guard of guards.splice(0)) guard.show();
});

/** Lets the mutation observer react. */
async function mutations() {
  await Promise.resolve();
}

beforeEach(() => {
  document.head.innerHTML = "<title>Trip plans - ChatGPT</title>";
});

describe("createTitleGuard", () => {
  it("shows the neutral title while hidden", () => {
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    expect(document.title).toBe("ChatGPT");
    expect(guard.hidden).toBe(true);
  });

  it("puts the site's title back when shown", () => {
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    guard.show();
    expect(document.title).toBe("Trip plans - ChatGPT");
    expect(guard.hidden).toBe(false);
  });

  it("keeps the neutral title when the site changes it", async () => {
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    document.title = "Another chat - ChatGPT";
    await mutations();
    expect(document.title).toBe("ChatGPT");
  });

  it("keeps the neutral title when the site replaces the title element", async () => {
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    document.head.innerHTML = "<title>Replaced - ChatGPT</title>";
    await mutations();
    expect(document.title).toBe("ChatGPT");
  });

  it("remembers the latest title the site asked for", async () => {
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    document.title = "Newest - ChatGPT";
    await mutations();
    guard.show();
    expect(document.title).toBe("Newest - ChatGPT");
  });

  it("stops watching once shown", async () => {
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    guard.show();
    document.title = "Changed later";
    await mutations();
    expect(document.title).toBe("Changed later");
  });

  it("can switch neutral titles while hidden", () => {
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    guard.hide("Claude");
    expect(document.title).toBe("Claude");
    guard.show();
    expect(document.title).toBe("Trip plans - ChatGPT");
  });

  it("works before the page has a head", async () => {
    const head = document.head;
    head.remove();
    const guard = createTitleGuard();
    guard.hide("ChatGPT");
    const late = document.createElement("head");
    late.innerHTML = "<title>Loaded later - ChatGPT</title>";
    document.documentElement.prepend(late);
    await mutations();
    expect(document.title).toBe("ChatGPT");
    late.replaceWith(head);
  });

  it("does nothing when shown without being hidden", () => {
    const guard = createTitleGuard();
    guard.show();
    expect(document.title).toBe("Trip plans - ChatGPT");
  });
});
