const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://app.easeia.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.easeia.com";
const GITHUB_URL = "https://github.com/unlockers-io/easeia-monorepo";
const DOCS_URL = `${GITHUB_URL}/blob/main/docs/self-hosting.md`;
const SITE_URL = "https://www.easeia.com";

const webAppUrl = (path: string) => new URL(path, WEB_APP_URL).href;
const apiUrl = (path: string) => new URL(path, API_URL).href;

export { apiUrl, DOCS_URL, GITHUB_URL, SITE_URL, webAppUrl };
