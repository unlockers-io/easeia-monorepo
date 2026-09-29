import type { Context, Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { secureHeaders } from "hono/secure-headers";

import { getActor } from "./actor";
import { getClientIp } from "./client-ip";

const STANDARD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const API_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export const apiRateLimitKey = (c: Context): string => {
  const actor = getActor(c);
  if (actor !== undefined && actor.id !== "") {
    return `actor:${actor.kind}:${actor.id}`;
  }
  return `ip:${getClientIp(c)}`;
};

const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    connectSrc: ["'self'"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'"],
    frameSrc: ["'none'"],
    imgSrc: ["'self'", "data:", "https:"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
  crossOriginEmbedderPolicy: "require-corp",
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "cross-origin",
  originAgentCluster: "?1",
  referrerPolicy: "no-referrer-when-downgrade",
  strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  xContentTypeOptions: "nosniff",
  xDnsPrefetchControl: "off",
  xDownloadOptions: "noopen",
  xFrameOptions: "DENY",
  xPermittedCrossDomainPolicies: "none",
  xXssProtection: "1; mode=block",
});

const docsSecurityHeaders = secureHeaders({
  contentSecurityPolicy: {
    connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://proxy.scalar.com"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    frameSrc: ["'none'"],
    imgSrc: ["'self'", "data:", "https:"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "cross-origin",
  originAgentCluster: "?1",
  referrerPolicy: "no-referrer-when-downgrade",
  strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  xContentTypeOptions: "nosniff",
  xDnsPrefetchControl: "off",
  xDownloadOptions: "noopen",
  xFrameOptions: "DENY",
  xPermittedCrossDomainPolicies: "none",
  xXssProtection: "1; mode=block",
});

export const standardRateLimit = rateLimiter({
  handler: (c: Context) => {
    c.res = c.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
        },
      },
      429,
    );
  },
  keyGenerator: (c: Context) => getClientIp(c),
  limit: 100,
  standardHeaders: "draft-6",
  windowMs: STANDARD_RATE_LIMIT_WINDOW_MS,
});

export const apiRateLimit = rateLimiter({
  handler: (c: Context) => {
    c.res = c.json(
      {
        error: {
          code: "API_RATE_LIMIT_EXCEEDED",
          message: "API rate limit exceeded, please slow down",
        },
      },
      429,
    );
  },
  keyGenerator: apiRateLimitKey,
  limit: 30,
  standardHeaders: "draft-6",
  windowMs: API_RATE_LIMIT_WINDOW_MS,
});

export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  return (c: Context, next: Next): Promise<Response> | Promise<void> => {
    const contentLength = c.req.header("content-length");

    if (
      contentLength !== undefined &&
      contentLength !== "" &&
      Math.trunc(Number(contentLength)) > maxSize
    ) {
      return Promise.resolve(
        c.json(
          {
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "Request entity too large",
            },
          },
          413,
        ),
      );
    }

    return next();
  };
};

export const apiSecurityHeaders = (c: Context<object, string>, next: Next) =>
  c.req.path === "/docs" ? docsSecurityHeaders(c, next) : securityHeaders(c, next);

export const createWaitlistRateLimit = () =>
  rateLimiter({
    handler: (c: Context) => {
      c.res = c.json(
        {
          error: {
            code: "WAITLIST_RATE_LIMIT_EXCEEDED",
            message: "Too many attempts. Please try again in an hour.",
          },
        },
        429,
      );
    },
    keyGenerator: getClientIp,
    limit: 5,
    standardHeaders: "draft-6",
    windowMs: 60 * 60 * 1000,
  });
