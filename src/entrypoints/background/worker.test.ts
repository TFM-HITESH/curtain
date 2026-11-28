import {
  SCHEMA_VERSION,
  createGuestState,
  defaultState,
  hashPin,
} from "@/core";
import { messages, readState, writeState } from "@/platform";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { startWorker, type Worker } from "./worker";

const START = Date.UTC(2026, 10, 28, 12, 0, 0);
const FAST = { iterations: 1000 };

let clock = START;
let worker: Worker;

async function launch() {
  worker = startWorker({ now: () => clock, hashOptions: FAST });
  await worker.ready;
}

async function setPin(pin: string) {
  await writeState({ pin: await hashPin(pin, FAST) });
}

beforeEach(async () => {
  fakeBrowser.reset();
  clock = START;
  await launch();
});

afterEach(() => {
  worker.stop();
});

describe("startup", () => {
  it("sets up a fresh install", async () => {
    expect(await readState(clock)).toEqual(defaultState());
    expect((await fakeBrowser.storage.local.get("schema"))["schema"]).toBe(
      SCHEMA_VERSION,
    );
  });

  it("leaves state from a newer version untouched", async () => {
    worker.stop();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.set({ schema: 99, marks: "future format" });
    await launch();
    expect(await fakeBrowser.storage.local.get(["schema", "marks"])).toEqual({
      schema: 99,
      marks: "future format",
    });
  });
});

describe("turning Guest mode on", () => {
  it("starts a session at the current time", async () => {
    expect(await messages.send("guest/turn-on", {})).toEqual({ ok: true });
    expect((await readState(clock)).guest).toEqual(createGuestState(START));
  });

  it("includes the chat open in the sender's tab", async () => {
    await messages.send("guest/turn-on", {
      openChat: { site: "chatgpt", chatId: "open" },
    });
    expect((await readState(clock)).guest?.session.chatgpt.chats).toEqual([
      "open",
    ]);
  });

  it("does nothing if it's already on", async () => {
    await messages.send("guest/turn-on", {});
    clock += 60_000;
    await messages.send("guest/turn-on", {});
    expect((await readState(clock)).guest?.startedAt).toBe(START);
  });

  it("never asks for the PIN", async () => {
    await setPin("1234");
    expect(await messages.send("guest/turn-on", {})).toEqual({ ok: true });
  });
});

describe("turning Guest mode off", () => {
  beforeEach(async () => {
    await messages.send("guest/turn-on", {});
  });

  it("does nothing if it's already off", async () => {
    await messages.send("guest/turn-off", {});
    expect(await messages.send("guest/turn-off", { pin: "0000" })).toEqual({
      ok: true,
    });
  });

  it("needs nothing when no PIN is set", async () => {
    expect(await messages.send("guest/turn-off", {})).toEqual({ ok: true });
    expect((await readState(clock)).guest).toBeNull();
  });

  it("asks for the PIN when one is set", async () => {
    await setPin("1234");
    expect(await messages.send("guest/turn-off", {})).toEqual({
      ok: false,
      reason: "pin-required",
    });
    expect((await readState(clock)).guest).not.toBeNull();
  });

  it("refuses a wrong PIN and counts it", async () => {
    await setPin("1234");
    expect(await messages.send("guest/turn-off", { pin: "0000" })).toEqual({
      ok: false,
      reason: "wrong-pin",
      attemptsLeft: 4,
    });
    expect((await readState(clock)).lockout.failures).toBe(1);
  });

  it("accepts the right PIN and clears the count", async () => {
    await setPin("1234");
    await messages.send("guest/turn-off", { pin: "0000" });
    expect(await messages.send("guest/turn-off", { pin: "1234" })).toEqual({
      ok: true,
    });
    const state = await readState(clock);
    expect(state.guest).toBeNull();
    expect(state.lockout).toEqual({ failures: 0, until: 0 });
  });

  it("blocks attempts for 30 seconds after five wrong ones", async () => {
    await setPin("1234");
    for (let i = 0; i < 4; i++) {
      await messages.send("guest/turn-off", { pin: "0000" });
    }
    expect(await messages.send("guest/turn-off", { pin: "0000" })).toEqual({
      ok: false,
      reason: "locked-out",
      retryInMs: 30_000,
    });

    clock += 10_000;
    expect(await messages.send("guest/turn-off", { pin: "1234" })).toEqual({
      ok: false,
      reason: "locked-out",
      retryInMs: 20_000,
    });

    clock += 20_000;
    expect(await messages.send("guest/turn-off", { pin: "1234" })).toEqual({
      ok: true,
    });
  });

  it("treats input that isn't a PIN as a wrong attempt", async () => {
    await setPin("1234");
    const result = await messages.send("guest/turn-off", { pin: "12345" });
    expect(result).toMatchObject({ ok: false, reason: "wrong-pin" });
  });
});

describe("session updates", () => {
  it("are ignored while Guest mode is off", async () => {
    await messages.send("session/add", {
      site: "chatgpt",
      kind: "chats",
      ids: ["a"],
    });
    expect((await readState(clock)).guest).toBeNull();
  });

  it("add valid IDs to the session", async () => {
    await messages.send("guest/turn-on", {});
    await messages.send("session/add", {
      site: "gemini",
      kind: "projects",
      ids: ["p1", "", "p1", "p2"],
    });
    expect((await readState(clock)).guest?.session.gemini.projects).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("reject requests for unknown sites or sets", async () => {
    await messages.send("guest/turn-on", {});
    await expect(
      messages.send("session/add", {
        site: "bing" as "chatgpt",
        kind: "chats",
        ids: ["a"],
      }),
    ).rejects.toThrow("Invalid request.");
    await expect(
      messages.send("session/add", {
        site: "chatgpt",
        kind: "revealed" as "chats",
        ids: ["a"],
      }),
    ).rejects.toThrow("Invalid request.");
  });

  it("record created chats and measure the clock difference", async () => {
    await messages.send("guest/turn-on", {});
    clock += 5000;
    await messages.send("session/chat-created", {
      site: "chatgpt",
      chatId: "new",
      serverTime: clock + 2000,
    });
    const guest = (await readState(clock)).guest;
    expect(guest?.session.chatgpt.chats).toEqual(["new"]);
    expect(guest?.skewMs).toBe(2000);
  });

  it("reject an empty chat ID", async () => {
    await messages.send("guest/turn-on", {});
    await expect(
      messages.send("session/chat-created", {
        site: "chatgpt",
        chatId: "",
        serverTime: null,
      }),
    ).rejects.toThrow("Invalid request.");
  });

  it("record created chats without a time", async () => {
    await messages.send("guest/turn-on", {});
    await messages.send("session/chat-created", {
      site: "claude",
      chatId: "new",
      serverTime: null,
    });
    const guest = (await readState(clock)).guest;
    expect(guest?.session.claude.chats).toEqual(["new"]);
    expect(guest?.skewMs).toBeNull();
  });

  it("ignore created chats while Guest mode is off", async () => {
    await messages.send("session/chat-created", {
      site: "claude",
      chatId: "new",
      serverTime: null,
    });
    expect((await readState(clock)).guest).toBeNull();
  });

  it("don't lose updates sent from many tabs at once", async () => {
    await messages.send("guest/turn-on", {});
    const ids = Array.from({ length: 25 }, (_, i) => `chat-${String(i)}`);
    await Promise.all(
      ids.map((chatId) =>
        messages.send("session/chat-created", {
          site: "chatgpt",
          chatId,
          serverTime: null,
        }),
      ),
    );
    const chats = (await readState(clock)).guest?.session.chatgpt.chats ?? [];
    expect([...chats].sort()).toEqual([...ids].sort());
  });
});

describe("showing a past chat with the PIN", () => {
  it("isn't available without a PIN", async () => {
    await messages.send("guest/turn-on", {});
    expect(
      await messages.send("session/reveal", {
        site: "chatgpt",
        chatId: "old",
        pin: "1234",
      }),
    ).toEqual({ ok: false, reason: "no-pin" });
  });

  it("reveals the chat with the right PIN", async () => {
    await setPin("1234");
    await messages.send("guest/turn-on", {});
    expect(
      await messages.send("session/reveal", {
        site: "chatgpt",
        chatId: "old",
        pin: "1234",
      }),
    ).toEqual({ ok: true });
    expect((await readState(clock)).guest?.session.chatgpt.revealed).toEqual([
      "old",
    ]);
  });

  it("refuses a wrong PIN", async () => {
    await setPin("1234");
    await messages.send("guest/turn-on", {});
    const result = await messages.send("session/reveal", {
      site: "chatgpt",
      chatId: "old",
      pin: "9999",
    });
    expect(result).toMatchObject({ ok: false, reason: "wrong-pin" });
    expect((await readState(clock)).guest?.session.chatgpt.revealed).toEqual(
      [],
    );
  });

  it("does nothing while Guest mode is off", async () => {
    expect(
      await messages.send("session/reveal", {
        site: "chatgpt",
        chatId: "old",
        pin: "1234",
      }),
    ).toEqual({ ok: true });
  });
});

describe("marks", () => {
  it("can be set, unset and cleared while Guest mode is off", async () => {
    await messages.send("marks/set", {
      site: "claude",
      chatId: "a",
      marked: true,
    });
    await messages.send("marks/set", {
      site: "claude",
      chatId: "b",
      marked: true,
    });
    await messages.send("marks/set", {
      site: "claude",
      chatId: "a",
      marked: false,
    });
    expect((await readState(clock)).marks.claude).toEqual(["b"]);

    await messages.send("marks/set", {
      site: "gemini",
      chatId: "g",
      marked: true,
    });
    await messages.send("marks/clear", { site: "claude" });
    expect((await readState(clock)).marks).toEqual({
      chatgpt: [],
      claude: [],
      gemini: ["g"],
    });
    await messages.send("marks/clear", {});
    expect((await readState(clock)).marks.gemini).toEqual([]);
  });

  it("can't be changed while Guest mode is on", async () => {
    await messages.send("marks/set", {
      site: "claude",
      chatId: "a",
      marked: true,
    });
    await messages.send("guest/turn-on", {});
    expect(
      await messages.send("marks/set", {
        site: "claude",
        chatId: "b",
        marked: true,
      }),
    ).toEqual({ ok: false, reason: "guest-on" });
    expect(await messages.send("marks/clear", {})).toEqual({
      ok: false,
      reason: "guest-on",
    });
    expect((await readState(clock)).marks.claude).toEqual(["a"]);
  });
});

describe("managing the PIN", () => {
  it("sets a first PIN without asking for one", async () => {
    expect(await messages.send("pin/set", { pin: "4821" })).toEqual({
      ok: true,
    });
    expect((await readState(clock)).pin?.algo).toBe("PBKDF2-SHA256");
  });

  it("needs the current PIN to change it", async () => {
    await setPin("1234");
    expect(await messages.send("pin/set", { pin: "4821" })).toEqual({
      ok: false,
      reason: "pin-required",
    });
    expect(
      await messages.send("pin/set", { pin: "4821", currentPin: "0000" }),
    ).toMatchObject({ ok: false, reason: "wrong-pin" });
    expect(
      await messages.send("pin/set", { pin: "4821", currentPin: "1234" }),
    ).toEqual({ ok: true });

    await messages.send("guest/turn-on", {});
    expect(await messages.send("guest/turn-off", { pin: "4821" })).toEqual({
      ok: true,
    });
  });

  it("rejects a PIN that isn't four digits", async () => {
    await expect(messages.send("pin/set", { pin: "12" })).rejects.toThrow(
      "A PIN must be exactly 4 digits.",
    );
  });

  it("needs the current PIN to remove it", async () => {
    await setPin("1234");
    expect(await messages.send("pin/remove", {})).toEqual({
      ok: false,
      reason: "pin-required",
    });
    expect(await messages.send("pin/remove", { currentPin: "1234" })).toEqual({
      ok: true,
    });
    expect((await readState(clock)).pin).toBeNull();
  });

  it("can't be changed while Guest mode is on", async () => {
    await messages.send("guest/turn-on", {});
    expect(await messages.send("pin/set", { pin: "4821" })).toEqual({
      ok: false,
      reason: "guest-on",
    });
    expect(await messages.send("pin/remove", {})).toEqual({
      ok: false,
      reason: "guest-on",
    });
  });
});
