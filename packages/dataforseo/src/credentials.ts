import { DataForSeoError } from "./error";

type Credentials = {
  login: string;
  password: string;
};

export class DataForSeoNotConfiguredError extends DataForSeoError {
  constructor() {
    super(503, "Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to enable SEO insights.");
    this.name = "DataForSeoNotConfiguredError";
  }
}

export const isDataForSeoConfigured = () =>
  (process.env.DATAFORSEO_LOGIN?.trim() ?? "") !== "" &&
  (process.env.DATAFORSEO_PASSWORD?.trim() ?? "") !== "";

export const loadCredentials = (): Credentials => {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();

  if (login === undefined || login === "" || password === undefined || password === "") {
    throw new DataForSeoNotConfiguredError();
  }

  return { login, password };
};

export const buildAuth = (creds: Credentials) =>
  `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString("base64")}`;
