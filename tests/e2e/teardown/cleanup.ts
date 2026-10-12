import { readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "@repo/db";
import { z } from "zod";

import { cleanupDirectory } from "../helpers/cleanup-record";

const recordSchema = z.object({ kind: z.enum(["user", "site", "waitlist"]), value: z.string() });
// Both an exact current-run record and a reserved test namespace are required.
const syntheticEmail =
  /^(?:e2e[-+a-z0-9]*@(?:easeia\.localhost|example\.com)|delivered\+(?:new-)?[a-z0-9-]+@resend\.dev)$/u;

const cleanup = async () => {
  const directory = cleanupDirectory();
  const files = await readdir(directory).catch(() => []);
  try {
    for (const file of files) {
      const contents = await readFile(join(directory, file), "utf8");
      const record = recordSchema.parse(JSON.parse(contents));
      if (record.kind === "site") {
        if (!/^e2e-[a-z0-9-]+\.example$/u.test(record.value)) {
          throw new Error("Refusing non-test site cleanup");
        }
        await prisma.site.deleteMany({ where: { domain: record.value } });
      } else {
        if (!syntheticEmail.test(record.value)) {
          throw new Error("Refusing non-test email cleanup");
        }
        if (record.kind === "waitlist") {
          await prisma.waitlistSignup.deleteMany({ where: { email: record.value } });
        } else {
          const users = await prisma.user.findMany({
            select: { id: true },
            where: { email: record.value },
          });
          await prisma.verification.deleteMany({
            where: { value: { in: users.map((user) => user.id) } },
          });
          await prisma.user.deleteMany({ where: { email: record.value } });
        }
      }
    }
    await rm(directory, { force: true, recursive: true });
  } finally {
    await prisma.$disconnect();
  }
};
export default cleanup;
