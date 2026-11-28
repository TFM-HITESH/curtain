import {
  MAX_ATTEMPTS,
  NO_LOCKOUT,
  addToSession,
  clearMarks,
  hashPin,
  isLockedOut,
  isSiteId,
  lockoutRemaining,
  migrate,
  normalizeIds,
  recordCreatedChat,
  recordFailure,
  recordSuccess,
  revealChat,
  setMark,
  startSession,
  verifyPin,
  type HashOptions,
  type SessionKind,
  type SiteId,
  type StorageState,
} from "@/core";
import {
  messages,
  readRawState,
  readState,
  writeState,
  type ActionResult,
} from "@/platform";

/**
 * The background worker: the only place that changes Curtain's state.
 *
 * Several tabs can report new chats at the same moment, and extension storage
 * has no transactions. So every change runs here, one at a time, on freshly
 * read state. Everything else only reads storage and listens for changes.
 */

export interface WorkerOptions {
  readonly now?: () => number;
  /** PIN hashing settings. Only tests change these. */
  readonly hashOptions?: HashOptions;
}

export interface Worker {
  /** Settles once stored state has been migrated. */
  readonly ready: Promise<void>;
  readonly stop: () => void;
}

const OK: ActionResult = { ok: true };
const GUEST_ON: ActionResult = { ok: false, reason: "guest-on" };
const SESSION_KINDS: readonly SessionKind[] = ["chats", "projects", "items"];

function invalid(): never {
  throw new Error("Invalid request.");
}

function siteOf(value: unknown): SiteId {
  return isSiteId(value) ? value : invalid();
}

function idOf(value: unknown): string {
  return normalizeIds([value])[0] ?? invalid();
}

export function startWorker({
  now = Date.now,
  hashOptions = {},
}: WorkerOptions = {}): Worker {
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs tasks one after another, so no two changes interleave. */
  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  /** Runs a change against freshly read state. */
  function change(task: (state: StorageState) => Promise<ActionResult>) {
    return serialize(async () => task(await readState(now())));
  }

  /**
   * Checks a PIN and updates the lockout. Passes when no PIN is set, so it
   * can guard any action that a PIN protects.
   */
  async function checkPin(
    state: StorageState,
    pin: unknown,
  ): Promise<ActionResult> {
    if (state.pin === null) return OK;
    const time = now();
    if (isLockedOut(state.lockout, time)) {
      return {
        ok: false,
        reason: "locked-out",
        retryInMs: lockoutRemaining(state.lockout, time),
      };
    }
    if (pin === undefined) return { ok: false, reason: "pin-required" };

    if (typeof pin === "string" && (await verifyPin(pin, state.pin))) {
      if (state.lockout.failures > 0) {
        await writeState({ lockout: recordSuccess() });
      }
      return OK;
    }

    const lockout = recordFailure(state.lockout, time);
    await writeState({ lockout });
    return isLockedOut(lockout, time)
      ? {
          ok: false,
          reason: "locked-out",
          retryInMs: lockoutRemaining(lockout, time),
        }
      : {
          ok: false,
          reason: "wrong-pin",
          attemptsLeft: MAX_ATTEMPTS - lockout.failures,
        };
  }

  const ready = serialize(async () => {
    const result = migrate(await readRawState(), now());
    // State from a newer build is left alone rather than overwritten.
    if (result.status === "migrated") await writeState(result.state);
  });

  const stop = messages.handle({
    "guest/turn-on": ({ openChat }) =>
      change(async ({ guest }) => {
        if (guest !== null) return OK;
        const start = openChat
          ? { site: siteOf(openChat.site), chatId: idOf(openChat.chatId) }
          : undefined;
        await writeState({ guest: startSession(now(), start) });
        return OK;
      }),

    "guest/turn-off": ({ pin }) =>
      change(async (state) => {
        if (state.guest === null) return OK;
        const check = await checkPin(state, pin);
        if (check.ok) await writeState({ guest: null });
        return check;
      }),

    "session/add": ({ site, kind, ids }) =>
      change(async ({ guest }) => {
        if (guest === null) return OK;
        if (!SESSION_KINDS.includes(kind)) invalid();
        await writeState({
          guest: addToSession(guest, siteOf(site), kind, normalizeIds(ids)),
        });
        return OK;
      }),

    "session/chat-created": ({ site, chatId, serverTime }) =>
      change(async ({ guest }) => {
        if (guest === null) return OK;
        const time =
          typeof serverTime === "number" && Number.isFinite(serverTime)
            ? serverTime
            : null;
        await writeState({
          guest: recordCreatedChat(
            guest,
            siteOf(site),
            idOf(chatId),
            time,
            now(),
          ),
        });
        return OK;
      }),

    "session/reveal": ({ site, chatId, pin }) =>
      change(async (state) => {
        if (state.guest === null) return OK;
        if (state.pin === null) return { ok: false, reason: "no-pin" };
        const check = await checkPin(state, pin);
        if (check.ok) {
          await writeState({
            guest: revealChat(state.guest, siteOf(site), idOf(chatId)),
          });
        }
        return check;
      }),

    "marks/set": ({ site, chatId, marked }) =>
      change(async ({ guest, marks }) => {
        if (guest !== null) return GUEST_ON;
        await writeState({
          marks: setMark(marks, siteOf(site), idOf(chatId), marked),
        });
        return OK;
      }),

    "marks/clear": ({ site }) =>
      change(async ({ guest, marks }) => {
        if (guest !== null) return GUEST_ON;
        await writeState({
          marks: clearMarks(
            marks,
            site === undefined ? undefined : siteOf(site),
          ),
        });
        return OK;
      }),

    "pin/set": ({ pin, currentPin }) =>
      change(async (state) => {
        if (state.guest !== null) return GUEST_ON;
        const check = await checkPin(state, currentPin);
        if (!check.ok) return check;
        await writeState({
          pin: await hashPin(pin, hashOptions),
          lockout: NO_LOCKOUT,
        });
        return OK;
      }),

    "health/report": ({ site, missing, failures }) =>
      change(async ({ health }) => {
        const id = siteOf(site);
        await writeState({
          health: {
            ...health,
            [id]: {
              missing: normalizeIds(missing),
              failures: normalizeIds(failures),
              checkedAt: now(),
            },
          },
        });
        return OK;
      }),

    "pin/remove": ({ currentPin }) =>
      change(async (state) => {
        if (state.guest !== null) return GUEST_ON;
        const check = await checkPin(state, currentPin);
        if (check.ok) await writeState({ pin: null, lockout: NO_LOCKOUT });
        return check;
      }),
  });

  return { ready, stop };
}
