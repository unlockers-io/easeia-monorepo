import { ExternalBacklinkSource, JobKind, type Prisma, prisma } from "@repo/db";
import { DomainError } from "@repo/errors";
import { enqueueUnlessInFlight } from "@repo/jobs";
import { isConnected } from "@repo/search-console";
import * as Sites from "@repo/sites";

import { parseExternalBacklinksCsv } from "./backlinks-csv";
import { sourceDomainOf } from "./hosts";

const LONG_TRANSACTION = { timeout: 60_000 };

export class GoogleNotConnectedError extends DomainError {
  constructor() {
    super("Connect Google in Settings before importing.", "GOOGLE_NOT_CONNECTED", 409);
    this.name = "GoogleNotConnectedError";
  }
}

type BacklinkRow = {
  linkingPages: number;
  siteId: string;
  source: ExternalBacklinkSource;
  sourceDomain: string;
};

const upsertBacklink = (
  tx: Prisma.TransactionClient,
  { linkingPages, siteId, source, sourceDomain }: BacklinkRow,
) =>
  tx.externalBacklink.upsert({
    create: { linkingPages, siteId, source, sourceDomain },
    update: { importedAt: new Date(), linkingPages },
    where: { siteId_sourceDomain_source: { siteId, source, sourceDomain } },
  });

export const importCsvBacklinks = async (
  siteId: string,
  csvText: string,
): Promise<{ imported: number; skipped: number }> => {
  const site = await Sites.load(siteId);
  const { rows, skipped } = parseExternalBacklinksCsv(csvText, { selfDomain: site.domain });

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await upsertBacklink(tx, { ...row, siteId: site.id, source: ExternalBacklinkSource.CSV });
    }
  }, LONG_TRANSACTION);

  return { imported: rows.length, skipped };
};

export const recordGscBacklinks = async (
  post: { id: string; siteId: string },
  referringUrls: ReadonlyArray<string>,
): Promise<{ domains: number }> => {
  if (referringUrls.length === 0) {
    return { domains: 0 };
  }

  const observed = new Set(referringUrls.flatMap((url) => sourceDomainOf(url) ?? []));

  return prisma.$transaction(async (tx) => {
    for (const referringUrl of referringUrls) {
      await tx.gscReferringUrl.upsert({
        create: { referringUrl, siteId: post.siteId, toPostId: post.id },
        update: { observedAt: new Date() },
        where: {
          siteId_toPostId_referringUrl: { referringUrl, siteId: post.siteId, toPostId: post.id },
        },
      });
    }

    const all = await tx.gscReferringUrl.findMany({
      select: { referringUrl: true },
      where: { siteId: post.siteId },
    });

    const pagesByDomain = new Map<string, Set<string>>();

    for (const { referringUrl } of all) {
      const domain = sourceDomainOf(referringUrl);

      if (domain !== null && observed.has(domain)) {
        pagesByDomain.set(domain, (pagesByDomain.get(domain) ?? new Set()).add(referringUrl));
      }
    }

    for (const [domain, pages] of pagesByDomain) {
      await upsertBacklink(tx, {
        linkingPages: pages.size,
        siteId: post.siteId,
        source: ExternalBacklinkSource.GSC_API,
        sourceDomain: domain,
      });
    }

    return { domains: pagesByDomain.size };
  }, LONG_TRANSACTION);
};

export const requestGscBacklinkBackfill = async (
  siteIds: ReadonlyArray<string>,
): Promise<{ queued: number }> => {
  if (!(await isConnected())) {
    throw new GoogleNotConnectedError();
  }

  let queued = 0;

  for (const siteId of siteIds) {
    const job = await enqueueUnlessInFlight({
      kind: JobKind.BACKFILL_GSC_LINKS,
      payload: { siteId },
      siteId,
    });

    queued += job === null ? 0 : 1;
  }

  return { queued };
};

export const externalBacklinkSummary = async (siteId: string) => {
  const [rows, recentReferringUrls] = await Promise.all([
    prisma.externalBacklink.findMany({
      select: { importedAt: true, linkingPages: true, sourceDomain: true },
      where: { siteId },
    }),
    prisma.gscReferringUrl.findMany({
      orderBy: { observedAt: "desc" },
      select: { observedAt: true, referringUrl: true },
      take: 10,
      where: { siteId },
    }),
  ]);

  const pagesByDomain = new Map<string, number>();

  for (const row of rows) {
    pagesByDomain.set(
      row.sourceDomain,
      Math.max(pagesByDomain.get(row.sourceDomain) ?? 0, row.linkingPages),
    );
  }

  const lastImportedAt = rows.reduce<Date | null>(
    (latest, row) => (latest === null || row.importedAt > latest ? row.importedAt : latest),
    null,
  );

  return {
    lastImportedAt,
    linkingPages: [...pagesByDomain.values()].reduce((sum, pages) => sum + pages, 0),
    recentReferringUrls,
    referringDomains: pagesByDomain.size,
  };
};
