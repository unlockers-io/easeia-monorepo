export const sourceDomainOf = (rawUrl: string): string | null => {
  const url = URL.parse(rawUrl);
  const host = url?.hostname.replace(/^www\./v, "").toLowerCase() ?? "";

  return host === "" ? null : host;
};
