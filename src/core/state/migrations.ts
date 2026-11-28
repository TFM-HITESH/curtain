import { normalizeState } from "./normalize";
import { SCHEMA_VERSION, type StorageState } from "./schema";

/**
 * Upgrades stored state from older schema versions.
 *
 * Each migration moves state from `version - 1` to `version`. They run in
 * order on startup, so an update never loses a running session or the owner's
 * marks. Never edit a released migration: add a new one and bump
 * `SCHEMA_VERSION`.
 */

type Raw = Readonly<Record<string, unknown>>;

export interface Migration {
  /** The schema version this migration produces. */
  readonly version: number;
  readonly migrate: (state: Raw) => Raw;
}

export const MIGRATIONS: readonly Migration[] = [
  // Version 1 is the first schema. Anything stored before it is an empty or
  // pre-release install, which normalization fills with defaults.
  { version: 1, migrate: (state) => state },
];

export type MigrationResult =
  /** Stored state was already current. It may still have been normalized. */
  | { readonly status: "current"; readonly state: StorageState }
  /** Stored state was upgraded and should be written back. */
  | {
      readonly status: "migrated";
      readonly from: number;
      readonly state: StorageState;
    }
  /**
   * Stored state comes from a newer version of Curtain. It's left untouched,
   * so going back to an older build can't damage it.
   */
  | { readonly status: "newer"; readonly version: number };

function storedVersion(raw: Raw): number {
  const version = raw["schema"];
  return typeof version === "number" &&
    Number.isSafeInteger(version) &&
    version > 0
    ? version
    : 0;
}

export function migrate(
  raw: Raw,
  now: number,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrationResult {
  const from = storedVersion(raw);
  if (from > target) return { status: "newer", version: from };

  let state = raw;
  for (const step of migrations) {
    if (step.version > from && step.version <= target) {
      state = step.migrate(state);
    }
  }

  const normalized = { ...normalizeState(state, now), schema: target };
  return from === target
    ? { status: "current", state: normalized }
    : { status: "migrated", from, state: normalized };
}
