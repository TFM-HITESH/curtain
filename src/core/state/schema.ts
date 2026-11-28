/**
 * The shape of everything Curtain keeps in `chrome.storage.local`.
 *
 * State is split across several keys so that change events stay small: a tab
 * that only cares about Guest mode doesn't hear about lockout updates. Only IDs
 * and timestamps are ever stored, never titles or content.
 */

/** The current storage schema version. Bump it together with a new migration. */
export const SCHEMA_VERSION = 1;

export const SITE_IDS = ["chatgpt", "claude", "gemini"] as const;
export type SiteId = (typeof SITE_IDS)[number];

/** What belongs to the current session on one site. */
export interface SessionSets {
  /** Chats that were open when Guest mode started or were created since. */
  readonly chats: readonly string[];
  /** Projects, notebooks and similar containers created during the session. */
  readonly projects: readonly string[];
  /** Other items, such as library files, created during the session. */
  readonly items: readonly string[];
  /** Chats shown for the rest of the session after entering the PIN. */
  readonly revealed: readonly string[];
}

/** Present only while Guest mode is on. Removed as a whole on exit. */
export interface GuestState {
  /** When Guest mode was turned on, in local epoch milliseconds. */
  readonly startedAt: number;
  /**
   * Measured difference between the site's server clock and the local clock,
   * in milliseconds (server minus local), or `null` until it's measured.
   */
  readonly skewMs: number | null;
  readonly session: Readonly<Record<SiteId, SessionSets>>;
}

/** Chats the owner chose to show in Guest mode. Kept across sessions. */
export type Marks = Readonly<Record<SiteId, readonly string[]>>;

export interface PinRecord {
  readonly algo: "PBKDF2-SHA256";
  readonly iterations: number;
  /** Base64-encoded random salt. */
  readonly salt: string;
  /** Base64-encoded derived key. */
  readonly hash: string;
}

export interface Lockout {
  /** Consecutive wrong PIN attempts. */
  readonly failures: number;
  /** Epoch milliseconds until which attempts are blocked, or 0. */
  readonly until: number;
}

export interface Prefs {
  readonly onboarded: boolean;
}

/** Every storage key and the type stored under it. */
export interface StorageState {
  readonly guest: GuestState | null;
  readonly marks: Marks;
  readonly pin: PinRecord | null;
  readonly lockout: Lockout;
  readonly prefs: Prefs;
  readonly schema: number;
}

export type StorageKey = keyof StorageState;

export const STORAGE_KEYS = [
  "guest",
  "marks",
  "pin",
  "lockout",
  "prefs",
  "schema",
] as const satisfies readonly StorageKey[];

function perSite<T>(make: () => T): Readonly<Record<SiteId, T>> {
  return { chatgpt: make(), claude: make(), gemini: make() };
}

export function emptySessionSets(): SessionSets {
  return { chats: [], projects: [], items: [], revealed: [] };
}

/** A fresh Guest mode session starting at `startedAt`. */
export function createGuestState(startedAt: number): GuestState {
  return { startedAt, skewMs: null, session: perSite(emptySessionSets) };
}

export function emptyMarks(): Marks {
  return perSite<readonly string[]>(() => []);
}

/** The state of a fresh install. */
export function defaultState(): StorageState {
  return {
    guest: null,
    marks: emptyMarks(),
    pin: null,
    lockout: { failures: 0, until: 0 },
    prefs: { onboarded: false },
    schema: SCHEMA_VERSION,
  };
}
