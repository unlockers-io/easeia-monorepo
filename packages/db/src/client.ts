import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

const createPrismaClient = (databaseUrl: string) => {
  // node-postgres reads a blank connection string as absent and connects to libpq's defaults.
  if (databaseUrl.trim() === "") {
    throw new Error("createPrismaClient needs a database URL and got a blank one.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
};

export { createPrismaClient };

export const pageOf = <Row extends { id: string }>(rows: ReadonlyArray<Row>, limit: number) => {
  const data = rows.slice(0, limit);

  return { data, nextCursor: rows.length > limit ? data.at(-1)?.id : undefined };
};

export const vectorLiteral = (vector: ReadonlyArray<number>): string => `[${vector.join(",")}]`;

export * from "./generated/prisma/client";
