import type { SiteDefinition } from "@/engine";

/** Where the extension runs. Used for host access and content scripts. */
export const MATCH_PATTERNS = [
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
] as const;

/**
 * Every supported site. Adding a site means adding its folder and one entry
 * here; the engine needs no changes.
 */
export const sites: readonly SiteDefinition[] = [];

/** The site running on a host name, if it's supported. */
export function siteForHost(
  hostname: string,
  registry: readonly SiteDefinition[] = sites,
): SiteDefinition | undefined {
  return registry.find((site) => site.hosts.includes(hostname));
}
