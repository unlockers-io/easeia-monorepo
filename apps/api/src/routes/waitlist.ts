import { createRoute, z } from "@hono/zod-openapi";
import { prisma } from "@repo/db";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

import { createRouter } from "@/lib/openapi";
import { errorResponse } from "@/lib/openapi-schemas";
import { createWaitlistRateLimit } from "@/middleware/security";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  source: z.string().trim().max(100).optional(),
  website: z.string().max(500).optional(),
});
type Signup = Pick<z.infer<typeof signupSchema>, "email" | "source">;

const acceptedSchema = z.object({ accepted: z.literal(true) });
const responseSchema = z.object({ data: acceptedSchema });

const route = createRoute({
  description:
    "Join the Cloud waitlist. New and existing addresses receive the same response. Limited to five requests per hour per IP.",
  method: "post",
  path: "/",
  request: { body: { content: { "application/json": { schema: signupSchema } }, required: true } },
  responses: {
    201: {
      content: {
        "application/json": { schema: responseSchema },
      },
      description: "Request accepted",
    },
    400: errorResponse("Invalid email or source"),
    413: errorResponse("Request body exceeds 4 KB"),
    429: errorResponse("Five requests per hour exceeded"),
  },
  security: [],
  summary: "Join the Cloud waitlist",
  tags: ["Waitlist"],
});

export const createWaitlistRoutes = (deps: {
  rateLimit: MiddlewareHandler;
  save: (signup: Signup) => Promise<void>;
}) => {
  const app = createRouter();
  app.use("*", deps.rateLimit);
  app.use(
    "*",
    bodyLimit({
      maxSize: 4096,
      onError: (c) =>
        c.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds 4 KB" } }, 413),
    }),
  );
  app.openapi(route, async (c) => {
    const { email, source, website } = c.req.valid("json");
    if (website === undefined || website === "") {
      await deps.save({ email, source });
    }
    return c.json({ data: { accepted: true as const } }, 201);
  });
  return app;
};

export const waitlistRoutes = createWaitlistRoutes({
  rateLimit: createWaitlistRateLimit(),
  save: async ({ email, source }) => {
    await prisma.waitlistSignup.upsert({ create: { email, source }, update: {}, where: { email } });
  },
});
