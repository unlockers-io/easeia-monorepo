import "dotenv/config";

import { prisma } from "@repo/db";

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`${name} must be set to seed a money site.`);
  }
  return value;
};

const main = async (): Promise<void> => {
  const domain = requireEnv("MONEY_SITE_DOMAIN").toLowerCase();
  const data = {
    contentPathPrefix: requireEnv("MONEY_SITE_PATH_PREFIX"),
    isEnabled: true,
    name: requireEnv("MONEY_SITE_NAME"),
    sitemapUrl: requireEnv("MONEY_SITE_SITEMAP_URL"),
  };
  const moneySite = await prisma.moneySite.upsert({
    create: { ...data, domain },
    update: data,
    where: { domain },
  });
  console.log("MoneySite:", moneySite.id, moneySite.domain);

  const result = await prisma.site.updateMany({
    data: { moneySiteId: moneySite.id },
    where: { isEnabled: true, moneySiteId: null },
  });
  console.log(`assigned moneySiteId to ${result.count} PBN sites`);
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
