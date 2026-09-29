export type HeroRow = {
  blobUrl: string;
  filename: string;
};

export type HeroPlan =
  | { filename: string; kind: "import"; sourceUrl: string }
  | { kind: "generate" }
  | { kind: "ready" }
  | { kind: "skip" };

export type PlanHeroInput = {
  autogenEnabled: boolean;
  featuredImage: string | null;
  hero: HeroRow | null;
  r2PublicBaseUrl: string | undefined;
};

const filenameFromUrl = (url: string): string => {
  const u = new URL(url);
  const tail = u.pathname.slice(u.pathname.lastIndexOf("/") + 1);
  return tail || "image";
};

const isR2Hosted = (url: string, r2Base: string | undefined): boolean =>
  r2Base !== undefined && r2Base !== "" && url.startsWith(r2Base);

export const planHero = ({
  autogenEnabled,
  featuredImage,
  hero,
  r2PublicBaseUrl,
}: PlanHeroInput): HeroPlan => {
  const foreignSource =
    featuredImage !== null && featuredImage !== "" && !isR2Hosted(featuredImage, r2PublicBaseUrl)
      ? featuredImage
      : null;

  // A foreign featuredImage names the hero we want, so the row is up to date
  // only if it already holds that exact file on R2. A filename mismatch means
  // the source image changed and must be re-imported.
  if (foreignSource !== null) {
    const filename = filenameFromUrl(foreignSource);
    const upToDate = hero?.filename === filename && isR2Hosted(hero.blobUrl, r2PublicBaseUrl);
    return upToDate ? { kind: "ready" } : { filename, kind: "import", sourceUrl: foreignSource };
  }

  // No usable import source, so the hero row is the whole truth, which is also
  // what the build feed reads.
  if (hero !== null) {
    return isR2Hosted(hero.blobUrl, r2PublicBaseUrl)
      ? { kind: "ready" }
      : { filename: hero.filename, kind: "import", sourceUrl: hero.blobUrl };
  }

  // Reaching here with a featuredImage means it points at our own bucket with
  // no row backing it. That previously matched neither branch, so the post
  // published heroless, silently, and only the hourly sweeper repaired it.
  return autogenEnabled ? { kind: "generate" } : { kind: "skip" };
};
