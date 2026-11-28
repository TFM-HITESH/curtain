import {
  emptyMarks,
  visibilityRules,
  type GuestState,
  type IsVisible,
  type Marks,
  type StorageState,
} from "@/core";
import {
  checkHealthLater,
  createGuard,
  createListWatcher,
  createMenuInjector,
  createTitleGuard,
  createdChat,
  installConcealer,
  showsPastContent,
  watchNavigation,
  type Concealer,
  type Guard,
  type HealthCheckOptions,
  type ListWatcherOptions,
  type MenuItem,
  type RouteChange,
  type SiteDefinition,
  type WatchNavigationOptions,
} from "@/engine";
import {
  messages,
  onStateChanged,
  readState,
  type StateChanges,
} from "@/platform";
import { siteForHost, sites } from "@/sites";
import {
  COVER_TEXT,
  MENU_TEXT,
  createCover,
  guestIcon,
  type Cover,
} from "@/ui";

/**
 * The content script, started at `document_start` on supported sites.
 *
 * Hiding starts straight away, before Guest mode's state is known, and stays
 * in place if storage never answers. Once Guest mode is known to be on, the
 * list watcher reveals what belongs to the session, and chats created in this
 * tab are reported so they join the session everywhere. A past chat's title
 * never shows in the tab bar, and the site's own menus offer Guest mode.
 *
 * Every feature runs through a guard. If one fails, it stops on its own, and
 * if Curtain can no longer follow Guest mode, the page goes back to hiding.
 * Failures and missing page elements are recorded on this device for the
 * popup to show.
 */

/** Feature names, as recorded when one stops after an error. */
const STATE = "state";
const RENDER = "render";
const NAVIGATION = "navigation";
const HEALTH = "health-check";
const TITLE = "title";
const COVER = "cover";

export interface ContentOptions {
  readonly hostname?: string;
  readonly doc?: Document;
  /** The sites to choose from. Only tests change this. */
  readonly registry?: readonly SiteDefinition[];
  /** Only tests change these. */
  readonly watcher?: ListWatcherOptions;
  readonly navigation?: WatchNavigationOptions;
  readonly health?: HealthCheckOptions;
  readonly now?: () => number;
  readonly navigate?: (href: string) => void;
}

export interface Content {
  readonly concealer: Concealer;
  readonly guard: Guard;
  readonly stop: () => void;
}

export function startContent({
  hostname = location.hostname,
  doc = document,
  registry = sites,
  watcher: watcherOptions = {},
  navigation: navigationOptions = {},
  health: healthOptions = {},
  now = Date.now,
  navigate = (href) => {
    location.assign(href);
  },
}: ContentOptions = {}): Content | undefined {
  const site = siteForHost(hostname, registry);
  if (!site) return undefined;

  const siteId = site.id;
  const chatRoute = site.routes.chat;
  const concealer = installConcealer(site, doc);

  let missing: readonly string[] = [];
  const missingMenus = new Set<string>();
  function reportHealth() {
    messages
      .send("health/report", {
        site: siteId,
        missing: [...missing, ...missingMenus],
        failures: guard.failures,
      })
      .catch(() => {
        // Health is only a hint for the popup; losing a report is fine.
      });
  }

  const guard = createGuard((feature) => {
    // Without these, Curtain can't follow Guest mode, so hide to be safe.
    if (feature === STATE || feature === RENDER) concealer.setMode("pending");
    reportHealth();
  });
  const watcher = createListWatcher(site, {
    doc,
    guard,
    ...watcherOptions,
  });

  const title = createTitleGuard(doc);
  const win = navigationOptions.win ?? window;

  // `undefined` means not known yet. Change events are always newer than the
  // first read, so the read only fills in what no event has told us.
  let guest: GuestState | null | undefined;
  let marks: Marks | undefined;
  let rules: IsVisible | null = null;

  function turnOn() {
    const chatId = chatRoute.exec(win.location.pathname)?.[1];
    // The chat open in this tab stays visible in the session.
    messages
      .send(
        "guest/turn-on",
        chatId ? { openChat: { site: siteId, chatId } } : {},
      )
      .catch(() => undefined);
  }

  function exitGuestMode() {
    // With a PIN set, the worker refuses until the PIN dialog asks for it.
    messages.send("guest/turn-off", {}).catch(() => undefined);
  }

  function menuItem(): MenuItem | null {
    if (guest === undefined) return null;
    return guest === null
      ? { label: MENU_TEXT.turnOn, icon: guestIcon, onSelect: turnOn }
      : { label: MENU_TEXT.turnOff, icon: guestIcon, onSelect: exitGuestMode };
  }

  const menus = createMenuInjector(site, menuItem, {
    doc,
    guard,
    onMissing: (menuId) => {
      const name = `menu:${menuId}`;
      if (missingMenus.has(name)) return;
      missingMenus.add(name);
      reportHealth();
    },
  });

  const cover: Cover | null = site.cover
    ? createCover({
        spec: site.cover,
        text: COVER_TEXT,
        doc,
        onNewChat: () => {
          if (site.cover) navigate(site.cover.newChatHref);
        },
        onExit: exitGuestMode,
      })
    : null;

  /**
   * While the page shows past content, the tab title is neutral and the chat
   * area is covered.
   */
  const updatePage = () => {
    const past =
      guest !== null &&
      showsPastContent(site, win.location.pathname, rules, now());
    guard.run(TITLE, () => {
      if (past) title.hide(site.title);
      else title.show();
    });
    guard.run(COVER, () => {
      if (past) cover?.show();
      else cover?.hide();
    });
  };

  function render() {
    guard.run(RENDER, renderNow);
    updatePage();
    menus.refresh();
  }

  function renderNow() {
    if (guest === undefined) return;
    if (guest === null) {
      rules = null;
      watcher.stop();
      concealer.setMode("off");
      return;
    }
    rules = visibilityRules({ guest, marks: marks ?? emptyMarks() }, siteId);
    // Decide every item before hiding switches from pending to Guest mode,
    // so nothing from an earlier session is shown even for a moment.
    watcher.start(rules);
    concealer.setMode("guest");
  }

  const stopListening = onStateChanged(
    guard.wrap(STATE, (changes: StateChanges) => {
      if (changes.guest === undefined && changes.marks === undefined) return;
      if (changes.guest !== undefined) guest = changes.guest;
      if (changes.marks !== undefined) marks = changes.marks;
      render();
    }),
  );

  const stopNavigation = watchNavigation(
    guard.wrap(NAVIGATION, (change: RouteChange) => {
      updatePage();
      // Only chats created while Guest mode is on join the session.
      if (!guest) return;
      const created = createdChat(site, change, now());
      if (!created) return;
      messages
        .send("session/chat-created", { site: siteId, ...created })
        .catch(() => {
          // If the worker can't be reached, the chat stays hidden: the safe side.
        });
    }),
    navigationOptions,
  );

  // Until Guest mode's state is known, a chat page counts as past content.
  updatePage();

  readState().then(
    guard.wrap(STATE, (state: StorageState) => {
      guest ??= state.guest;
      marks ??= state.marks;
      render();
    }),
    () => {
      // Without an answer the page stays hidden, which is the safe outcome.
    },
  );

  menus.start();

  const cancelHealthCheck = checkHealthLater(
    site,
    guard.wrap(HEALTH, (found: string[]) => {
      missing = found;
      reportHealth();
    }),
    { doc, ...healthOptions },
  );

  return {
    concealer,
    guard,
    stop: () => {
      cancelHealthCheck();
      title.show();
      cover?.hide();
      menus.stop();
      stopNavigation();
      stopListening();
      watcher.stop();
      concealer.stop();
    },
  };
}
