import type { SiteDefinition } from "@/engine";

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
