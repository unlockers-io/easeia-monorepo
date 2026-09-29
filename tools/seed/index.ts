import "dotenv/config";

import { readFile } from "node:fs/promises";

import { prisma } from "@repo/db";
import * as Sites from "@repo/sites";
import { z } from "zod";

import { seedAdmin } from "./admin";

const seedSchema = z.array(
  z.object({
    domain: z.string().min(1),
  }),
);

const main = async () => {
  await seedAdmin();

  const file = process.argv.at(2);
  if (file !== undefined && file !== "") {
    const raw: unknown = JSON.parse(await readFile(file, "utf8"));
    const entries = seedSchema.parse(raw);
    for (const entry of entries) {
      const site = await Sites.upsert({
        domain: entry.domain,
      });
      console.log(`upserted ${site.domain}`);
    }
  } else {
    console.log("(no sites file — skipping Site seed)");
  }

  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
