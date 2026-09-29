type ErrorClass = abstract new (...args: ReadonlyArray<never>) => Error;

export type ProviderResult<T> = { data: T; ok: true } | { error: string; ok: false };

export const tryProvider = async <T>(
  fn: () => Promise<T>,
  expectedErrors: ReadonlyArray<ErrorClass>,
): Promise<ProviderResult<T>> => {
  try {
    return { data: await fn(), ok: true };
  } catch (error) {
    if (expectedErrors.some((cls) => error instanceof cls)) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
    throw error;
  }
};
