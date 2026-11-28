import {
  SCHEMA_VERSION,
  SITE_IDS,
  createGuestState,
  type GuestState,
  type Lockout,
  type Marks,
  type PinRecord,
  type Prefs,
  type SessionSets,
  type SiteId,
  type StorageState,
} from "./schema";

/**
 * Turns whatever is in storage into a well-formed `StorageState`.
 *
 * Storage can hold anything: older formats, partial writes or hand edits. Each
 * key is checked on its own, and anything malformed falls back to a safe value.
 * "Safe" follows the fail-closed rule: a damaged Guest mode record keeps Guest
 * mode on with an empty session rather than switching it off.
 */

type Raw = Readonly<Record<string, unknown>>;

const MAX_ID_LENGTH = 256;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Keeps valid, unique IDs in their original order. */
export function normalizeIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const id of value) {
    if (typeof id === "string" && id.length > 0 && id.length <= MAX_ID_LENGTH) {
      ids.add(id);
    }
  }
  return [...ids];
}

function perSite<T>(
  raw: unknown,
  read: (value: unknown) => T,
): Record<SiteId, T> {
  const source = isRecord(raw) ? raw : {};
  const result = {} as Record<SiteId, T>;
  for (const site of SITE_IDS) result[site] = read(source[site]);
  return result;
}

function normalizeSessionSets(value: unknown): SessionSets {
  const raw = isRecord(value) ? value : {};
  return {
    chats: normalizeIds(raw["chats"]),
    projects: normalizeIds(raw["projects"]),
    items: normalizeIds(raw["items"]),
    revealed: normalizeIds(raw["revealed"]),
  };
}

export function normalizeGuest(value: unknown, now: number): GuestState | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || !isTimestamp(value["startedAt"])) {
    return createGuestState(now);
  }
  const skewMs = value["skewMs"];
  return {
    startedAt: value["startedAt"],
    skewMs: typeof skewMs === "number" && Number.isFinite(skewMs) ? skewMs : 0,
    session: perSite(value["session"], normalizeSessionSets),
  };
}

export function normalizeMarks(value: unknown): Marks {
  return perSite(value, normalizeIds);
}

/**
 * A damaged PIN record can never be verified, so it's dropped rather than
 * locking the owner out for good. Curtain's PIN is a courtesy, not a security
 * boundary, and only someone editing extension storage could cause this.
 */
export function normalizePin(value: unknown): PinRecord | null {
  if (!isRecord(value)) return null;
  const { algo, iterations, salt, hash } = value;
  if (
    algo !== "PBKDF2-SHA256" ||
    !isCount(iterations) ||
    iterations === 0 ||
    typeof salt !== "string" ||
    salt.length === 0 ||
    typeof hash !== "string" ||
    hash.length === 0
  ) {
    return null;
  }
  return { algo, iterations, salt, hash };
}

export function normalizeLockout(value: unknown): Lockout {
  const raw = isRecord(value) ? value : {};
  return {
    failures: isCount(raw["failures"]) ? raw["failures"] : 0,
    until: isTimestamp(raw["until"]) ? raw["until"] : 0,
  };
}

export function normalizePrefs(value: unknown): Prefs {
  const raw = isRecord(value) ? value : {};
  return { onboarded: raw["onboarded"] === true };
}

/** Normalizes every key of a current-version state. */
export function normalizeState(raw: Raw, now: number): StorageState {
  return {
    guest: normalizeGuest(raw["guest"], now),
    marks: normalizeMarks(raw["marks"]),
    pin: normalizePin(raw["pin"]),
    lockout: normalizeLockout(raw["lockout"]),
    prefs: normalizePrefs(raw["prefs"]),
    schema: SCHEMA_VERSION,
  };
}
