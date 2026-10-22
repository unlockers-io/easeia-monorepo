import { PostValidationError } from "./errors";

type SafeParseLike<T> =
  | { data: T; success: true }
  | { error: { issues: Array<{ message: string; path: Array<PropertyKey> }> }; success: false };

type Parser<I, T> = { safeParse: (raw: I) => SafeParseLike<T> };

export const parseOrThrow = <I, T>(schema: Parser<I, T>, raw: I): T => {
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    throw new PostValidationError(
      parsed.error.issues.map((i) => ({
        message: i.message,
        path: i.path.join("."),
      })),
    );
  }

  return parsed.data;
};
