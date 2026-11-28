import { beforeEach, describe, expect, it } from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { createMessenger } from "./messaging";

interface TestMessages {
  add: { request: { a: number; b: number }; response: number };
  greet: { request: string; response: string };
  fail: { request: null; response: never };
}

const messenger = createMessenger<TestMessages>();

beforeEach(() => {
  fakeBrowser.reset();
});

describe("createMessenger", () => {
  it("delivers a request and returns the response", async () => {
    messenger.handle({ add: ({ a, b }) => a + b });
    expect(await messenger.send("add", { a: 2, b: 3 })).toBe(5);
  });

  it("supports asynchronous handlers", async () => {
    messenger.handle({ greet: async (name) => Promise.resolve(`hi ${name}`) });
    expect(await messenger.send("greet", "you")).toBe("hi you");
  });

  it("passes handler errors back to the sender", async () => {
    messenger.handle({
      fail: () => {
        throw new Error("PIN required");
      },
    });
    await expect(messenger.send("fail", null)).rejects.toThrow("PIN required");
  });

  it("passes non-Error rejections back as text", async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    messenger.handle({ fail: () => Promise.reject("nope") });
    await expect(messenger.send("fail", null)).rejects.toThrow("nope");
  });

  it("fails clearly when no handler takes the message", async () => {
    messenger.handle({ add: ({ a, b }) => a + b });
    await expect(messenger.send("greet", "you")).rejects.toThrow(
      'Nothing handled "greet".',
    );
  });

  it("ignores messages that aren't Curtain's", async () => {
    messenger.handle({ add: ({ a, b }) => a + b });
    expect(
      await browser.runtime.sendMessage({ type: "add", request: {} }),
    ).toBeUndefined();
  });

  it("stops handling when unsubscribed", async () => {
    const stop = messenger.handle({ add: ({ a, b }) => a + b });
    messenger.handle({ greet: (name) => name });
    stop();
    await expect(messenger.send("add", { a: 1, b: 1 })).rejects.toThrow(
      'Nothing handled "add".',
    );
  });
});
