import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { t } from "./i18n";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("t", () => {
  it("returns the translated message", () => {
    vi.spyOn(fakeBrowser.i18n, "getMessage").mockReturnValue("ltr");
    expect(t("@@bidi_dir")).toBe("ltr");
  });

  it("passes substitutions through", () => {
    const getMessage = vi
      .spyOn(fakeBrowser.i18n, "getMessage")
      .mockReturnValue("x");
    t("@@ui_locale", ["a", "b"]);
    expect(getMessage).toHaveBeenCalledWith("@@ui_locale", ["a", "b"]);
  });

  it("falls back to the key when a message is missing", () => {
    vi.spyOn(fakeBrowser.i18n, "getMessage").mockReturnValue("");
    expect(t("@@ui_locale")).toBe("@@ui_locale");
  });
});
