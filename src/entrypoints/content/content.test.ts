// @vitest-environment happy-dom
import { createGuestState, startSession } from "@/core";
import { defineSite } from "@/engine";
import { writeState } from "@/platform";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { startContent, type Content } from "./content";

const site = defineSite({
  id: "claude",
  hosts: ["claude.ai"],
  title: "Claude",
  routes: { newChat: /^\/new$/, chat: /^\/chat\/([^/]+)/ },
  surfaces: [
    {
      kind: "filter",
      id: "chats",
      item: "a[data-chat-row]",
      itemKind: "chat",
      idFrom: { href: /\/chat\/([^/?#]+)/ },
    },
  ],
});
const registry = [site];

let content: Content | undefined;

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  content?.stop();
  content = undefined;
  vi.restoreAllMocks();
});

/** Lets every pending promise settle. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function mode() {
  return document.documentElement.getAttribute("data-curtain");
}

describe("startContent", () => {
  it("does nothing on unsupported sites", () => {
    content = startContent({ hostname: "example.com", registry });
    expect(content).toBeUndefined();
    expect(mode()).toBeNull();
  });

  it("hides straight away, before storage answers", () => {
    content = startContent({ hostname: "claude.ai", registry });
    expect(mode()).toBe("pending");
  });

  it("switches to off once storage says Guest mode is off", async () => {
    content = startContent({ hostname: "claude.ai", registry });
    await vi.waitFor(() => {
      expect(mode()).toBe("off");
    });
  });

  it("switches to guest once storage says Guest mode is on", async () => {
    await writeState({ guest: createGuestState(Date.now()) });
    content = startContent({ hostname: "claude.ai", registry });
    await vi.waitFor(() => {
      expect(mode()).toBe("guest");
    });
  });

  it("follows Guest mode as it changes", async () => {
    content = startContent({ hostname: "claude.ai", registry });
    await vi.waitFor(() => {
      expect(mode()).toBe("off");
    });
    await writeState({ guest: createGuestState(Date.now()) });
    expect(mode()).toBe("guest");
    await writeState({ guest: null });
    expect(mode()).toBe("off");
  });

  it("ignores changes to other keys", async () => {
    const started = startContent({ hostname: "claude.ai", registry });
    content = started;
    await vi.waitFor(() => {
      expect(mode()).toBe("off");
    });
    started?.concealer.setMode("guest");
    await writeState({ prefs: { onboarded: true } });
    expect(mode()).toBe("guest");
  });

  it("doesn't let a slow first read undo a newer change", async () => {
    let finishRead: (value: Record<string, unknown>) => void = () => undefined;
    const slowRead = new Promise<Record<string, unknown>>((resolve) => {
      finishRead = resolve;
    });
    // `get` is overloaded, so the mock needs a cast to its promise form.
    const get = vi
      .spyOn(fakeBrowser.storage.local, "get")
      .mockReturnValueOnce(slowRead as never);
    content = startContent({ hostname: "claude.ai", registry });
    expect(get).toHaveBeenCalledOnce();
    await writeState({ guest: createGuestState(Date.now()) });
    expect(mode()).toBe("guest");

    // The first read finishes late, with the state from before the change.
    finishRead({});
    await settle();
    expect(mode()).toBe("guest");
  });

  it("waits for Guest mode's state before acting on marks", async () => {
    let finishRead: (value: Record<string, unknown>) => void = () => undefined;
    const slowRead = new Promise<Record<string, unknown>>((resolve) => {
      finishRead = resolve;
    });
    vi.spyOn(fakeBrowser.storage.local, "get").mockReturnValueOnce(
      slowRead as never,
    );
    content = startContent({ hostname: "claude.ai", registry });
    await writeState({ marks: { chatgpt: [], claude: ["a"], gemini: [] } });
    expect(mode()).toBe("pending");
    finishRead({});
    await settle();
    expect(mode()).toBe("off");
  });

  it("stays hidden if storage can't be read", async () => {
    const get = vi
      .spyOn(fakeBrowser.storage.local, "get")
      .mockRejectedValueOnce(new Error("unavailable"));
    content = startContent({ hostname: "claude.ai", registry });
    await settle();
    expect(get).toHaveBeenCalledOnce();
    expect(mode()).toBe("pending");
  });

  describe("with a sidebar", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <a data-chat-row href="/chat/session" id="session"></a>
        <a data-chat-row href="/chat/old" id="old"></a>
      `;
    });

    function shown(id: string) {
      return (
        document.getElementById(id)?.hasAttribute("data-curtain-ok") ?? false
      );
    }

    it("reveals only session chats once Guest mode is on", async () => {
      await writeState({
        guest: startSession(Date.now(), { site: "claude", chatId: "session" }),
      });
      content = startContent({ hostname: "claude.ai", registry });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      expect(shown("session")).toBe(true);
      expect(shown("old")).toBe(false);
    });

    it("shows a chat once it's marked", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      content = startContent({ hostname: "claude.ai", registry });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      expect(shown("old")).toBe(false);
      await writeState({
        marks: { chatgpt: [], claude: ["old"], gemini: [] },
      });
      expect(shown("old")).toBe(true);
    });

    it("stops deciding when Guest mode turns off", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      content = startContent({ hostname: "claude.ai", registry });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      await writeState({ guest: null });
      expect(mode()).toBe("off");
    });
  });
});
