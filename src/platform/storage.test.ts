import { createGuestState, defaultState } from "@/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { onStateChanged, readRawState, readState, writeState } from "./storage";

const NOW = Date.UTC(2026, 10, 28, 12, 0, 0);

beforeEach(() => {
  fakeBrowser.reset();
});

describe("readState", () => {
  it("returns the default state for an empty store", async () => {
    expect(await readState(NOW)).toEqual(defaultState());
  });

  it("normalizes what's stored", async () => {
    await browser.storage.local.set({ marks: { chatgpt: ["a", "a", 1] } });
    expect((await readState(NOW)).marks.chatgpt).toEqual(["a"]);
  });
});

describe("readRawState", () => {
  it("returns only Curtain's keys, as stored", async () => {
    await browser.storage.local.set({ marks: "odd", unrelated: true });
    expect(await readRawState()).toEqual({ marks: "odd" });
  });
});

describe("writeState", () => {
  it("writes only the given keys", async () => {
    await writeState({ prefs: { onboarded: true } });
    const state = await readState(NOW);
    expect(state.prefs.onboarded).toBe(true);
    expect(state.guest).toBeNull();
  });
});

describe("onStateChanged", () => {
  it("reports normalized new values for changed keys", async () => {
    const listener = vi.fn();
    onStateChanged(listener, () => NOW);
    await writeState({ guest: createGuestState(NOW) });
    expect(listener).toHaveBeenCalledWith({ guest: createGuestState(NOW) });
  });

  it("reports a removed key as its safe value", async () => {
    await writeState({ guest: createGuestState(NOW) });
    const listener = vi.fn();
    onStateChanged(listener, () => NOW);
    await browser.storage.local.remove("guest");
    expect(listener).toHaveBeenCalledWith({ guest: null });
  });

  it("ignores keys that aren't Curtain's", async () => {
    const listener = vi.fn();
    onStateChanged(listener);
    await browser.storage.local.set({ unrelated: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops listening when unsubscribed", async () => {
    const listener = vi.fn();
    const stop = onStateChanged(listener);
    stop();
    await writeState({ prefs: { onboarded: true } });
    expect(listener).not.toHaveBeenCalled();
  });
});
