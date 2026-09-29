import { LinkType } from "@repo/db";

import type { ExtractedLink } from "./extract";

export type ClassifiedLink = ExtractedLink & {
  slug: string | null;
  toSiteId: string | null;
  type: LinkType;
};

/** A classified link with its target Post resolved (null = no such Post). */
export type ResolvedLink = ClassifiedLink & {
  toPostId: string | null;
};

export type NetworkSite = {
  domain: string;
  id: string;
};

const stripWww = (host: string): string => host.replace(/^www\./v, "");

const hostOf = (href: string, base: string): string | null => {
  try {
    return stripWww(new URL(href, base).hostname);
  } catch {
    return null;
  }
};

const slugFromUrl = (href: string, base: string): string | null => {
  try {
    const u = new URL(href, base);
    const segs = u.pathname.split("/").filter(Boolean);
    return segs.at(-1) ?? null;
  } catch {
    return null;
  }
};

export const classifyLinks = (params: {
  base: string;
  links: ReadonlyArray<ExtractedLink>;
  network: ReadonlyArray<NetworkSite>;
  ownSiteDomain: string;
  ownSiteId: string;
}): Array<ClassifiedLink> => {
  const ownDomain = stripWww(params.ownSiteDomain);
  const networkDomains = new Map<string, string>();
  for (const s of params.network) {
    networkDomains.set(stripWww(s.domain), s.id);
  }

  return params.links.map((link) => {
    const host = hostOf(link.href, params.base);
    const slug = slugFromUrl(link.href, params.base);
    if (host !== null && host !== "") {
      if (host === ownDomain) {
        return { ...link, slug, toSiteId: params.ownSiteId, type: LinkType.INTERNAL };
      }
      const networkId = networkDomains.get(host);
      if (networkId !== undefined) {
        return { ...link, slug, toSiteId: networkId, type: LinkType.PBN };
      }
    }
    return { ...link, slug, toSiteId: null, type: LinkType.EXTERNAL };
  });
};
