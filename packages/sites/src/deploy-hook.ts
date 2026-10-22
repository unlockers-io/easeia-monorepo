export const parseDeployHook = (raw: string | null): URL | null => {
  if (raw === null || raw === "") {
    return null;
  }

  if (!URL.canParse(raw)) {
    return null;
  }

  const parsed = new URL(raw);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  return parsed;
};
