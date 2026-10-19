import { z } from "zod";

import { buildAuth, loadCredentials } from "./credentials";
import { DataForSeoError } from "./error";

const jsonValueSchema = z.json();
type JsonValue = z.infer<typeof jsonValueSchema>;

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
