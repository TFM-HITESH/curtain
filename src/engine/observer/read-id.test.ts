// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readId } from "./read-id";

function element(html: string): Element {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const first = template.content.firstElementChild;
  if (!first) throw new Error("No element");
  return first;
}

describe("readId", () => {
  it("reads an attribute as it is", () => {
    expect(
      readId(element('<div data-id="g-p-1"></div>'), { attribute: "data-id" }),
    ).toBe("g-p-1");
  });

  it("reads the capture group from an attribute", () => {
    const row = element('<div data-key="chatgpt:conversation:abc"></div>');
    expect(readId(row, { attribute: "data-key", match: /:([^:]+)$/ })).toBe(
      "abc",
    );
  });

  it("returns null for a missing, empty or unmatched attribute", () => {
    const source = { attribute: "data-key", match: /^chat:(.+)$/ };
    expect(readId(element("<div></div>"), source)).toBeNull();
    expect(readId(element('<div data-key=""></div>'), source)).toBeNull();
    expect(readId(element('<div data-key="other"></div>'), source)).toBeNull();
  });

  it("reads a link's URL, on the item or inside it", () => {
    const source = { href: /\/c\/([^/?#]+)/ };
    expect(readId(element('<a href="/c/abc?x=1"></a>'), source)).toBe("abc");
    expect(
      readId(
        element(
          '<li><span></span><a href="https://chatgpt.com/c/def"></a></li>',
        ),
        source,
      ),
    ).toBe("def");
  });

  it("returns null without a matching link", () => {
    const source = { href: /\/c\/([^/?#]+)/ };
    expect(readId(element("<li></li>"), source)).toBeNull();
    expect(readId(element('<a href=""></a>'), source)).toBeNull();
    expect(readId(element('<a href="/settings"></a>'), source)).toBeNull();
  });
});
