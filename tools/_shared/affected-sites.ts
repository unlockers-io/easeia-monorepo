import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const AFFECTED_SITES_FILE = "/tmp/easeia-affected-site-ids.json";

export const readAffectedSites = (): Array<string> => {
  if (!existsSync(AFFECTED_SITES_FILE)) {
    return [];
  }
  const raw: unknown = JSON.parse(readFileSync(AFFECTED_SITES_FILE, "utf8"));
  if (!Array.isArray(raw)) {
    throw new TypeError(`${AFFECTED_SITES_FILE}: expected a JSON array`);
  }
  return raw.filter((v): v is string => typeof v === "string");
};

/** Union of what is already pending and what this run touched. */
export const recordAffectedSites = (siteIds: ReadonlyArray<string>): Array<string> => {
  const merged = [...new Set([...readAffectedSites(), ...siteIds])];
  writeFileSync(AFFECTED_SITES_FILE, JSON.stringify(merged, null, 2));
  return merged;
};

export const clearAffectedSites = (): void => {
  writeFileSync(AFFECTED_SITES_FILE, JSON.stringify([], null, 2));
};
