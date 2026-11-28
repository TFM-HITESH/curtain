import { defineSite, siteProblems } from "@/engine";
import { describe, expect, it } from "vitest";
import { siteForHost, sites } from ".";

describe("registered sites", () => {
  it.each(sites.map((site) => [site.id, site] as const))(
    "%s follows the definition rules",
    (_, site) => {
      expect(siteProblems(site)).toEqual([]);
    },
  );

  it("have unique IDs and hosts", () => {
    const ids = sites.map((site) => site.id);
    const hosts = sites.flatMap((site) => site.hosts);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hosts).size).toBe(hosts.length);
  });
});

describe("siteForHost", () => {
  const claude = defineSite({
    id: "claude",
    hosts: ["claude.ai"],
    title: "Claude",
    routes: { newChat: /^\/new$/, chat: /^\/chat\/([0-9a-f-]+)/ },
    surfaces: [],
  });

  it("finds a site by host name", () => {
    expect(siteForHost("claude.ai", [claude])).toBe(claude);
  });

  it("returns nothing for other hosts", () => {
    expect(siteForHost("example.com", [claude])).toBeUndefined();
    expect(siteForHost("claude.ai")).toBeUndefined();
  });
});
