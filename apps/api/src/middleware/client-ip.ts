import { isIP } from "node:net";

import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

const normalizeIp = (value: string) => value.trim().replace(/^::ffff:/v, "");

// Only a proxy whose socket address is explicitly trusted may supply client IPs.
// Walk from the nearest proxy so user-supplied prefixes cannot create new buckets.
export const resolveClientIp = (
  peer: string,
  forwarded: string | undefined,
  trusted: ReadonlySet<string>,
): string => {
  const address = normalizeIp(peer);
  if (!trusted.has(address) || forwarded === undefined || forwarded === "") {
    return address;
  }
  const chain = forwarded.split(",").map(normalizeIp);
  let client = address;
  for (const hop of chain.toReversed()) {
    if (!trusted.has(client)) {
      break;
    }
    if (isIP(hop) === 0) {
      return address;
    }
    client = hop;
  }
  return client;
};

const trustedProxies = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? "")
    .split(",")
    .map(normalizeIp)
    .filter((ip) => isIP(ip) !== 0),
);

export const getClientIp = (c: Context): string => {
  let peer: string | undefined;
  try {
    peer = getConnInfo(c).remote.address;
  } catch {
    /* Non-Node test adapters share a conservative bucket. */
  }
  return resolveClientIp(peer ?? "unknown", c.req.header("x-forwarded-for"), trustedProxies);
};
