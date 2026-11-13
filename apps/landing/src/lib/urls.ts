import { origins } from "@repo/identity";

const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL ?? origins.web;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? origins.api;
const GITHUB_URL = "https://github.com/unlockers-io/easeia-monorepo";
const DOCS_URL = `${GITHUB_URL}/blob/main/docs/self-hosting.md`;

const webAppUrl = (path: string) => new URL(path, WEB_APP_URL).href;
const apiUrl = (path: string) => new URL(path, API_URL).href;

export { apiUrl, DOCS_URL, GITHUB_URL, webAppUrl };
