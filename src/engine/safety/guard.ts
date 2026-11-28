/**
 * Keeping failures contained.
 *
 * Curtain runs inside sites it doesn't control, and a site change can make any
 * feature throw. Each feature runs through a guard: the first error turns off
 * that one feature for the rest of the page's life and is reported, while
 * everything else keeps working. The hiding stylesheet is never touched, so a
 * failure can leave too much hidden, never too little.
 */

export interface Guard {
  /** Runs `task` as part of `feature`, unless that feature has already failed. */
  run<T>(feature: string, task: () => T): T | undefined;
  /** Wraps a callback so every call runs through `run`. */
  wrap<A extends unknown[]>(
    feature: string,
    callback: (...args: A) => unknown,
  ): (...args: A) => void;
  /** Whether a feature has stopped after an error. */
  failed(feature: string): boolean;
  /** Every feature that has stopped. */
  readonly failures: readonly string[];
}

export function createGuard(
  onFailure: (feature: string, error: unknown) => void = () => undefined,
): Guard {
  const stopped = new Set<string>();

  function fail(feature: string, error: unknown) {
    if (stopped.has(feature)) return;
    stopped.add(feature);
    onFailure(feature, error);
  }

  function run<T>(feature: string, task: () => T): T | undefined {
    if (stopped.has(feature)) return undefined;
    try {
      const result = task();
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          fail(feature, error);
        });
      }
      return result;
    } catch (error) {
      fail(feature, error);
      return undefined;
    }
  }

  return {
    run,
    wrap(feature, callback) {
      return (...args) => {
        run(feature, () => callback(...args));
      };
    },
    failed: (feature) => stopped.has(feature),
    get failures() {
      return [...stopped];
    },
  };
}
