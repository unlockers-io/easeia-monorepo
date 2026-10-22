import { type Niche, type Post, prisma } from "@repo/db";

const NICHE_PT = {
  ARCHITECTURE: "Arquitetura",
  AUDIO: "Áudio",
  BUSINESS: "Negócios",
  COMMERCIAL: "Comercial",
  CULTURE: "Cultura",
  EVENTS: "Eventos",
  FASHION: "Moda",
  FILM: "Cinema",
  FOOD: "Gastronomia",
  LIFESTYLE: "Estilo de Vida",
  PHOTOGRAPHY: "Fotografia",
  PORTRAIT: "Retratos",
  REAL_ESTATE: "Imóveis",
  TECH: "Tecnologia",
  TRAVEL: "Viagem",
  VIDEOGRAPHY: "Videografia",
  WEDDING: "Casamentos",
} satisfies Record<Niche, string>;

const FALLBACK_CATEGORY = "Geral";

type SitePost = { categories: ReadonlyArray<string>; niches: ReadonlyArray<Niche> };

const argmax = (counts: Map<string, number>): string | null => {
  let best: string | null = null;
  let bestN = 0;

  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  }

  return best;
};

const pickExistingCategory = (
  sitePosts: ReadonlyArray<SitePost>,
  postNiches: ReadonlyArray<Niche>,
): string | null => {
  const nicheSet = new Set(postNiches);
  const overall = new Map<string, number>();
  const nicheMatched = new Map<string, number>();

  for (const p of sitePosts) {
    const overlaps = p.niches.some((n) => nicheSet.has(n));

    for (const c of p.categories) {
      overall.set(c, (overall.get(c) ?? 0) + 1);

      if (overlaps) {
        nicheMatched.set(c, (nicheMatched.get(c) ?? 0) + 1);
      }
    }
  }

  return argmax(nicheMatched) ?? argmax(overall);
};

export const fallbackCategory = async (post: Pick<Post, "niches" | "siteId">): Promise<string> => {
  const sitePosts = await prisma.post.findMany({
    select: { categories: true, niches: true },
    where: { categories: { isEmpty: false }, siteId: post.siteId },
  });

  const existing = pickExistingCategory(sitePosts, post.niches);

  if (existing !== null && existing !== "") {
    return existing;
  }

  const firstNiche = post.niches.at(0);

  return firstNiche ? NICHE_PT[firstNiche] : FALLBACK_CATEGORY;
};
