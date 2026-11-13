const apps = {
  api: { name: "easeia.api", port: 4000 },
  landing: { name: "easeia.landing", port: 3001 },
  web: { name: "easeia.web", port: 3000 },
} as const;

const urlEnv = {
  CORS_ORIGINS: ["web", "landing"],
  NEXT_PUBLIC_API_URL: ["api"],
  NEXT_PUBLIC_WEB_APP_URL: ["web"],
  WEB_APP_URL: ["web"],
} as const satisfies Record<string, ReadonlyArray<keyof typeof apps>>;

export { apps, urlEnv };
