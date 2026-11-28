// @vitest-environment happy-dom
import { createGuestState, startSession } from "@/core";
import { defineSite } from "@/engine";
import { messages, writeState, type CurtainMessages } from "@/platform";
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

  describe("chats created in this tab", () => {
    type Created = CurtainMessages["session/chat-created"]["request"];

    function fakeNavigation(pathname: string) {
      const location = { pathname };
      const navigation = new EventTarget();
      return {
        win: { location, navigation } as unknown as Window,
        go(path: string, navigationType: string) {
          location.pathname = path;
          navigation.dispatchEvent(
            Object.assign(new Event("currententrychange"), { navigationType }),
          );
        },
      };
    }

    function captureCreated() {
      const created: Created[] = [];
      messages.handle({
        "session/chat-created": (request) => {
          created.push(request);
          return { ok: true };
        },
      });
      return created;
    }

    async function startOn(path: string) {
      const nav = fakeNavigation(path);
      content = startContent({
        hostname: "claude.ai",
        registry,
        navigation: { win: nav.win },
      });
      await vi.waitFor(() => {
        expect(mode()).not.toBe("pending");
      });
      return nav;
    }

    it("are reported while Guest mode is on", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      const created = captureCreated();
      const nav = await startOn("/new");
      nav.go("/chat/abc", "push");
      await vi.waitFor(() => {
        expect(created).toEqual([
          { site: "claude", chatId: "abc", serverTime: null },
        ]);
      });
    });

    it("aren't reported while Guest mode is off", async () => {
      const created = captureCreated();
      const nav = await startOn("/new");
      nav.go("/chat/abc", "push");
      await settle();
      expect(created).toEqual([]);
    });

    it("don't include chats opened by going back", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      const created = captureCreated();
      const nav = await startOn("/new");
      nav.go("/chat/old", "traverse");
      await settle();
      expect(created).toEqual([]);
    });

    it("fail quietly if the worker can't be reached", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      const nav = await startOn("/new");
      nav.go("/chat/abc", "push");
      await settle();
      expect(mode()).toBe("guest");
    });
  });

  describe("when something fails", () => {
    type Report = CurtainMessages["health/report"]["request"];

    function captureReports() {
      const reports: Report[] = [];
      messages.handle({
        "health/report": (request) => {
          reports.push(request);
          return { ok: true };
        },
      });
      return reports;
    }

    it("stops only the feature that failed and records it", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      const reports = captureReports();
      content = startContent({
        hostname: "claude.ai",
        registry,
        watcher: {
          schedule: () => {
            throw new Error("site changed");
          },
        },
      });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      document.body.insertAdjacentHTML(
        "beforeend",
        '<a data-chat-row href="/chat/late"></a>',
      );
      await vi.waitFor(() => {
        expect(reports.at(-1)?.failures).toEqual(["list-watcher"]);
      });
      expect(content?.guard.failed("list-watcher")).toBe(true);
      expect(mode()).toBe("guest");
    });

    it("goes back to hiding if it can't follow Guest mode", async () => {
      const broken = defineSite({
        ...site,
        surfaces: [
          {
            kind: "filter",
            id: "chats",
            item: "[data-chat-row",
            itemKind: "chat",
            idFrom: { href: /\/chat\/(\w+)/ },
          },
        ],
      });
      await writeState({ guest: createGuestState(Date.now()) });
      const reports = captureReports();
      content = startContent({ hostname: "claude.ai", registry: [broken] });
      await vi.waitFor(() => {
        expect(reports.at(-1)?.failures).toEqual(["render"]);
      });
      expect(mode()).toBe("pending");
    });
  });

  describe("site health", () => {
    it("reports anchors that are missing after the page loads", async () => {
      const withAnchors = defineSite({
        ...site,
        anchors: [
          { id: "sidebar", selector: "nav[data-sidebar]" },
          { id: "composer", selector: "[data-composer]" },
        ],
      });
      document.body.innerHTML = "<nav data-sidebar></nav>";
      const reports: CurtainMessages["health/report"]["request"][] = [];
      messages.handle({
        "health/report": (request) => {
          reports.push(request);
          return { ok: true };
        },
      });
      content = startContent({
        hostname: "claude.ai",
        registry: [withAnchors],
        health: { delayMs: 0, path: () => "/new" },
      });
      await vi.waitFor(() => {
        expect(reports).toEqual([
          { site: "claude", missing: ["composer"], failures: [] },
        ]);
      });
    });

    it("doesn't mind if the report can't be delivered", async () => {
      content = startContent({
        hostname: "claude.ai",
        registry,
        health: { delayMs: 0 },
      });
      await settle();
      await settle();
      expect(mode()).not.toBeNull();
    });
  });

  describe("tab title", () => {
    function onPath(pathname: string) {
      const location = { pathname };
      const navigation = new EventTarget();
      return {
        win: { location, navigation } as unknown as Window,
        go(path: string) {
          location.pathname = path;
          navigation.dispatchEvent(
            Object.assign(new Event("currententrychange"), {
              navigationType: "push",
            }),
          );
        },
      };
    }

    beforeEach(() => {
      document.title = "Trip plans - Claude";
    });

    it("is neutral on a chat page before Guest mode's state is known", () => {
      content = startContent({
        hostname: "claude.ai",
        registry,
        navigation: { win: onPath("/chat/old").win },
      });
      expect(document.title).toBe("Claude");
    });

    it("stays neutral on a past chat in Guest mode", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      content = startContent({
        hostname: "claude.ai",
        registry,
        navigation: { win: onPath("/chat/old").win },
      });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      expect(document.title).toBe("Claude");
    });

    it("comes back on a session chat", async () => {
      await writeState({
        guest: startSession(Date.now(), { site: "claude", chatId: "mine" }),
      });
      content = startContent({
        hostname: "claude.ai",
        registry,
        navigation: { win: onPath("/chat/mine").win },
      });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      expect(document.title).toBe("Trip plans - Claude");
    });

    it("follows navigation between chats", async () => {
      await writeState({
        guest: startSession(Date.now(), { site: "claude", chatId: "mine" }),
      });
      const nav = onPath("/chat/mine");
      content = startContent({
        hostname: "claude.ai",
        registry,
        navigation: { win: nav.win },
      });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      nav.go("/chat/old");
      expect(document.title).toBe("Claude");
      nav.go("/new");
      expect(document.title).toBe("Trip plans - Claude");
    });

    it("isn't touched while Guest mode is off", async () => {
      content = startContent({
        hostname: "claude.ai",
        registry,
        navigation: { win: onPath("/chat/old").win },
      });
      await vi.waitFor(() => {
        expect(mode()).toBe("off");
      });
      expect(document.title).toBe("Trip plans - Claude");
    });
  });

  describe("cover", () => {
    const covered = defineSite({
      ...site,
      cover: { target: "main[data-thread]", newChatHref: "/new" },
    });

    function at(pathname: string) {
      const location = { pathname };
      const navigation = new EventTarget();
      return {
        win: { location, navigation } as unknown as Window,
        go(path: string) {
          location.pathname = path;
          navigation.dispatchEvent(
            Object.assign(new Event("currententrychange"), {
              navigationType: "push",
            }),
          );
        },
      };
    }

    function coverShown() {
      return document.querySelector("[data-curtain-cover]") !== null;
    }

    beforeEach(() => {
      document.body.innerHTML = "<main data-thread><p>Old chat</p></main>";
    });

    it("covers a past chat as soon as the page loads", () => {
      content = startContent({
        hostname: "claude.ai",
        registry: [covered],
        navigation: { win: at("/chat/old").win },
      });
      expect(coverShown()).toBe(true);
    });

    it("comes off a session chat and when Guest mode turns off", async () => {
      await writeState({
        guest: startSession(Date.now(), { site: "claude", chatId: "mine" }),
      });
      const nav = at("/chat/old");
      content = startContent({
        hostname: "claude.ai",
        registry: [covered],
        navigation: { win: nav.win },
      });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      expect(coverShown()).toBe(true);
      nav.go("/chat/mine");
      expect(coverShown()).toBe(false);
      nav.go("/chat/old");
      expect(coverShown()).toBe(true);

      await writeState({ guest: null });
      expect(coverShown()).toBe(false);
    });

    it("starts a new chat and exits Guest mode from its buttons", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      const turnOff = vi.fn(() => ({ ok: true as const }));
      messages.handle({ "guest/turn-off": turnOff });
      const navigate = vi.fn();
      content = startContent({
        hostname: "claude.ai",
        registry: [covered],
        navigation: { win: at("/chat/old").win },
        navigate,
      });
      await vi.waitFor(() => {
        expect(mode()).toBe("guest");
      });
      const [newChat, exit] = document.querySelectorAll<HTMLButtonElement>(
        "[data-curtain-cover] button",
      );
      newChat?.click();
      expect(navigate).toHaveBeenCalledWith("/new");
      exit?.click();
      await vi.waitFor(() => {
        expect(turnOff).toHaveBeenCalledOnce();
      });
    });

    it("isn't used on sites without one", () => {
      content = startContent({
        hostname: "claude.ai",
        registry,
        navigation: { win: at("/chat/old").win },
      });
      expect(coverShown()).toBe(false);
    });
  });

  describe("site menu", () => {
    const withMenu = defineSite({
      ...site,
      menus: [
        {
          id: "user",
          menu: "[role=menu]",
          template: "[role=menuitem][data-kind=settings]",
        },
      ],
    });

    function at(pathname: string) {
      return {
        win: {
          location: { pathname },
          navigation: new EventTarget(),
        } as unknown as Window,
      };
    }

    function menuItem() {
      return document.querySelector<HTMLElement>("[data-curtain-menu-item]");
    }

    beforeEach(() => {
      document.body.innerHTML = `
        <div role="menu">
          <div role="menuitem" data-kind="settings"><svg></svg><span>Settings</span></div>
        </div>`;
    });

    it("offers Guest mode while it's off, and turns it on", async () => {
      const turnOn = vi.fn(() => ({ ok: true as const }));
      messages.handle({ "guest/turn-on": turnOn });
      content = startContent({
        hostname: "claude.ai",
        registry: [withMenu],
        navigation: at("/chat/abc"),
      });
      await vi.waitFor(() => {
        expect(menuItem()?.textContent).toBe("Guest mode");
      });
      menuItem()?.click();
      await vi.waitFor(() => {
        expect(turnOn).toHaveBeenCalledWith(
          { openChat: { site: "claude", chatId: "abc" } },
          expect.anything(),
        );
      });
    });

    it("turns on without an open chat from other pages", async () => {
      const turnOn = vi.fn(() => ({ ok: true as const }));
      messages.handle({ "guest/turn-on": turnOn });
      content = startContent({
        hostname: "claude.ai",
        registry: [withMenu],
        navigation: at("/new"),
      });
      await vi.waitFor(() => {
        expect(menuItem()).not.toBeNull();
      });
      menuItem()?.click();
      await vi.waitFor(() => {
        expect(turnOn).toHaveBeenCalledWith({}, expect.anything());
      });
    });

    it("offers Exit guest mode while it's on", async () => {
      await writeState({ guest: createGuestState(Date.now()) });
      const turnOff = vi.fn(() => ({ ok: true as const }));
      messages.handle({ "guest/turn-off": turnOff });
      content = startContent({
        hostname: "claude.ai",
        registry: [withMenu],
        navigation: at("/new"),
      });
      await vi.waitFor(() => {
        expect(menuItem()?.textContent).toBe("Exit guest mode");
      });
      menuItem()?.click();
      await vi.waitFor(() => {
        expect(turnOff).toHaveBeenCalledOnce();
      });
    });

    it("offers nothing until Guest mode's state is known", () => {
      content = startContent({
        hostname: "claude.ai",
        registry: [withMenu],
        navigation: at("/new"),
      });
      expect(menuItem()).toBeNull();
    });

    it("reports a menu that has changed, once", async () => {
      const reports: CurtainMessages["health/report"]["request"][] = [];
      messages.handle({
        "health/report": (request) => {
          reports.push(request);
          return { ok: true };
        },
      });
      document.body.innerHTML =
        '<div role="menu"><div role="menuitem">Changed</div></div>';
      content = startContent({
        hostname: "claude.ai",
        registry: [withMenu],
        navigation: at("/new"),
      });
      await vi.waitFor(() => {
        expect(reports.at(-1)?.missing).toEqual(["menu:user"]);
      });
      document.body.insertAdjacentHTML("beforeend", "<p>more</p>");
      await settle();
      expect(reports.filter((r) => r.missing.length > 0)).toHaveLength(1);
    });
  });
});
