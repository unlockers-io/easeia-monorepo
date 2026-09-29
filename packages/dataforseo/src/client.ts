/* eslint-disable max-classes-per-file -- the not-configured error subclasses the client's base error */
import { z } from "zod";

const taskStatusSchema = z.looseObject({
  status_code: z.number().optional(),
  status_message: z.string().optional(),
});

const taskListSchema = z.array(taskStatusSchema).optional();

const taskEnvelopeSchema = z.looseObject({
  tasks: taskListSchema,
});
const jsonValueSchema = z.json();
type JsonValue = z.infer<typeof jsonValueSchema>;

type Credentials = {
  login: string;
  password: string;
};

export class DataForSeoError extends Error {
  details?: JsonValue;
  status: number;
  constructor(status: number, message: string, details?: JsonValue) {
    super(`DataForSEO ${status}: ${message}`);
    this.details = details;
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

const loadCredentials = (override?: Credentials): Credentials => {
  if (override) {
    return override;
  }
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

export type RequestInput<Output> = {
  body: ReadonlyArray<JsonValue>;
  credentials?: Credentials;
  path: string;
  schema: z.ZodType<Output>;
  signal?: AbortSignal;
};

export const request = async <Output>(input: RequestInput<Output>): Promise<Output> => {
  const creds = loadCredentials(input.credentials);
  const res = await fetch(`${BASE}${input.path}`, {
    body: JSON.stringify(input.body),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: buildAuth(creds),
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: input.signal,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DataForSeoError(res.status, text.slice(0, 200));
  }
  const json = jsonValueSchema.parse(JSON.parse(text));
  const envelope = taskEnvelopeSchema.parse(json);
  const task = envelope.tasks?.[0];
  const taskStatus = task?.status_code;
  if (
    taskStatus !== undefined &&
    taskStatus !== 0 &&
    taskStatus !== 20_000 &&
    taskStatus !== 20_100
  ) {
    throw new DataForSeoError(taskStatus, task?.status_message ?? "task error", json);
  }
  return input.schema.parse(json);
};

export const stripScheme = (urlOrDomain: string): string =>
  urlOrDomain.replace(/^https?:\/\//v, "").replace(/\/.*$/v, "");
