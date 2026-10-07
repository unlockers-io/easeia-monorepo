/* eslint-disable max-classes-per-file -- the not-configured error subclasses the client's base error */
import { z } from "zod";

const jsonValueSchema = z.json();
type JsonValue = z.infer<typeof jsonValueSchema>;

type Credentials = {
  login: string;
  password: string;
};

export class DataForSeoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`DataForSEO ${status}: ${message}`);
    this.status = status;
  }
}

export class DataForSeoNotConfiguredError extends DataForSeoError {
  constructor() {
    super(503, "Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to enable SEO insights.");
    this.name = "DataForSeoNotConfiguredError";
  }
}
export const isDataForSeoConfigured = () =>
  (process.env.DATAFORSEO_LOGIN?.trim() ?? "") !== "" &&
  (process.env.DATAFORSEO_PASSWORD?.trim() ?? "") !== "";

const loadCredentials = (): Credentials => {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (login === undefined || login === "" || password === undefined || password === "") {
    throw new DataForSeoNotConfiguredError();
  }
  return { login, password };
};

const buildAuth = (creds: Credentials) =>
  `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString("base64")}`;

const BASE = "https://api.dataforseo.com";

const OK_STATUSES: ReadonlySet<number> = new Set([20_000, 20_100]);

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type Transport = {
  fetch: Fetch;
  timeoutMs: number;
};

const statusSchema = {
  status_code: z.number(),
  status_message: z.string(),
};

const envelopeSchema = <Result extends z.ZodType>(result: Result) => {
  const task = z.object({ ...statusSchema, result: z.array(result).nullish() });
  return z.object({ ...statusSchema, tasks: z.array(task).nullable() });
};

const send = async (transport: Transport, path: string, body: ReadonlyArray<JsonValue>) => {
  const creds = loadCredentials();
  const signal = AbortSignal.timeout(transport.timeoutMs);
  try {
    const res = await transport.fetch(`${BASE}${path}`, {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: buildAuth(creds),
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (error) {
    if (signal.aborted) {
      throw new DataForSeoError(504, `no response within ${transport.timeoutMs}ms`);
    }
    throw new DataForSeoError(502, error instanceof Error ? error.message : String(error));
  }
};

const parseJson = (text: string): JsonValue => {
  try {
    return jsonValueSchema.parse(JSON.parse(text));
  } catch {
    throw new DataForSeoError(502, "response is not JSON");
  }
};

export const createRequest =
  (transport: Transport) =>
  async <Result>(
    path: string,
    body: ReadonlyArray<JsonValue>,
    result: z.ZodType<Result>,
  ): Promise<Result | null> => {
    const response = await send(transport, path, body);
    if (!response.ok) {
      throw new DataForSeoError(response.status, response.text.slice(0, 200));
    }
    const parsed = envelopeSchema(result).safeParse(parseJson(response.text));
    if (!parsed.success) {
      throw new DataForSeoError(502, "unexpected response shape");
    }
    const task = parsed.data.tasks?.[0];
    for (const status of [parsed.data, task]) {
      if (status !== undefined && !OK_STATUSES.has(status.status_code)) {
        throw new DataForSeoError(status.status_code, status.status_message);
      }
    }
    return task?.result?.[0] ?? null;
  };

export const stripScheme = (urlOrDomain: string): string =>
  urlOrDomain.replace(/^https?:\/\//v, "").replace(/\/.*$/v, "");
