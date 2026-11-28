/**
 * Comparing server times with the local clock.
 *
 * Creation times read from IDs come from the site's servers, while Guest mode
 * records its start with the local clock. The two can disagree. When a chat is
 * seen being created during the session, comparing its ID time with the local
 * time gives the difference, and later comparisons use it.
 *
 * Errors here are safe in one direction only, so the margins are kept small: a
 * new item judged too old stays hidden (and is usually still caught by seeing
 * it being created), while an old item judged too new would be shown.
 */

/** A measured difference larger than this means something is wrong. */
export const MAX_SKEW_MS = 24 * 60 * 60 * 1000;

/** Allowed early margin before the clock difference has been measured. */
export const UNMEASURED_TOLERANCE_MS = 10_000;

/** Allowed early margin once the clock difference is known. */
export const MEASURED_TOLERANCE_MS = 2_000;

/**
 * The clock difference (server minus local) implied by an item whose server
 * creation time is `serverTime` and which was seen being created locally at
 * `localTime`. Returns `null` if the difference is too large to trust.
 */
export function measureSkew(
  serverTime: number,
  localTime: number,
): number | null {
  const skew = serverTime - localTime;
  return Math.abs(skew) <= MAX_SKEW_MS ? skew : null;
}

/**
 * Whether an item created at `serverTime` (from its ID) was created after
 * Guest mode started at local time `startedAt`.
 */
export function createdInSession(
  serverTime: number,
  startedAt: number,
  skewMs: number | null,
): boolean {
  const tolerance =
    skewMs === null ? UNMEASURED_TOLERANCE_MS : MEASURED_TOLERANCE_MS;
  return serverTime >= startedAt + (skewMs ?? 0) - tolerance;
}
