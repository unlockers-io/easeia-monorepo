import { Niche } from "@repo/db/browser";
import { z } from "zod";

const nicheSchema = z.enum(Niche);

export const parseNiches = (input: string | Array<string> | undefined): Array<Niche> =>
  [input ?? []].flat().filter((value): value is Niche => nicheSchema.safeParse(value).success);
