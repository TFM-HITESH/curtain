// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  document.body.removeAttribute("style");
  document.body.innerHTML = "";
});

describe("resolveTheme", () => {
  it("reads colours and font from the page", () => {
    document.body.style.backgroundColor = "rgb(33, 33, 33)";
    document.body.style.color = "rgb(236, 236, 236)";
    document.body.style.fontFamily = "Inter, sans-serif";
    const theme = resolveTheme(document);
    expect(theme.surface).toBe("rgb(33, 33, 33)");
    expect(theme.text).toBe("rgb(236, 236, 236)");
    expect(theme.font).toBe("Inter, sans-serif");
    expect(theme.headingFont).toBe("Inter, sans-serif");
    expect(theme.muted).toBe(
      "color-mix(in srgb, rgb(236, 236, 236) 68%, rgb(33, 33, 33))",
    );
  });

  it("looks past a transparent body to the page background", () => {
    document.body.style.backgroundColor = "rgba(0, 0, 0, 0)";
    document.documentElement.style.backgroundColor = "rgb(250, 249, 245)";
    expect(resolveTheme(document).surface).toBe("rgb(250, 249, 245)");
  });

  it("falls back to system values when nothing is set", () => {
    const theme = resolveTheme(document);
    expect(theme.surface).toBe("Canvas");
    expect(theme.font).not.toBe("");
    expect(theme.text).not.toBe("");
  });

  it("prefers the site's tokens, with the page's values as fallbacks", () => {
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    document.body.style.color = "rgb(13, 13, 13)";
    const theme = resolveTheme(document, {
      surface: "--main-surface",
      text: "--text-primary",
      muted: "--text-secondary",
      border: "--border-light",
    });
    expect(theme.surface).toBe("var(--main-surface, rgb(255, 255, 255))");
    expect(theme.text).toBe("var(--text-primary, rgb(13, 13, 13))");
    expect(theme.muted).toMatch(/^var\(--text-secondary, color-mix\(/);
    expect(theme.border).toMatch(/^var\(--border-light, color-mix\(/);
  });

  it("copies fonts from the elements the site names", () => {
    document.body.style.fontFamily = "serif";
    document.body.innerHTML = `
      <div data-composer style="font-family: 'Google Sans'"></div>
      <h1 data-greeting style="font-family: Georgia"></h1>
    `;
    const theme = resolveTheme(document, {
      fontFrom: "[data-composer]",
      headingFontFrom: "[data-greeting]",
    });
    expect(theme.font).toBe('"Google Sans"');
    expect(theme.headingFont).toBe("Georgia");
  });

  it("uses the body's font if a named element is missing", () => {
    document.body.style.fontFamily = "Arial";
    expect(resolveTheme(document, { fontFrom: "[data-missing]" }).font).toBe(
      "Arial",
    );
  });
});
