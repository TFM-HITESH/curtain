import { describe, expect, it, vi } from "vitest";
import { createGuard } from "./guard";

describe("createGuard", () => {
  it("runs tasks and returns their result", () => {
    const guard = createGuard();
    expect(guard.run("menu", () => 42)).toBe(42);
    expect(guard.failures).toEqual([]);
  });

  it("stops a feature after its first error and reports it once", () => {
    const onFailure = vi.fn();
    const guard = createGuard(onFailure);
    const error = new Error("selector broke");
    const result: unknown = guard.run("menu", (): unknown => {
      throw error;
    });
    expect(result).toBeUndefined();

    const task = vi.fn(() => 1);
    expect(guard.run("menu", task)).toBeUndefined();
    expect(task).not.toHaveBeenCalled();
    expect(guard.failed("menu")).toBe(true);
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith("menu", error);
  });

  it("keeps other features running", () => {
    const guard = createGuard();
    guard.run("menu", () => {
      throw new Error("boom");
    });
    expect(guard.run("cover", () => "still here")).toBe("still here");
    expect(guard.failed("cover")).toBe(false);
    expect(guard.failures).toEqual(["menu"]);
  });

  it("catches rejected promises too", async () => {
    const onFailure = vi.fn();
    const guard = createGuard(onFailure);
    await guard
      .run("bridge", () => Promise.reject(new Error("later")))
      ?.catch(() => undefined);
    expect(guard.failed("bridge")).toBe(true);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("reports once when several async tasks of a feature fail", async () => {
    const onFailure = vi.fn();
    const guard = createGuard(onFailure);
    const first = guard.run("bridge", () => Promise.reject(new Error("a")));
    const second = guard.run("bridge", () => Promise.reject(new Error("b")));
    await Promise.allSettled([first, second]);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("wraps callbacks", () => {
    const guard = createGuard();
    const seen: number[] = [];
    const callback = guard.wrap("observer", (value: number) => {
      if (value < 0) throw new Error("negative");
      seen.push(value);
    });
    callback(1);
    callback(-1);
    callback(2);
    expect(seen).toEqual([1]);
    expect(guard.failed("observer")).toBe(true);
  });
});
