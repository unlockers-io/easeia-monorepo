export type ActionResult<T> = { data: T; ok: true } | { error: string; ok: false };
export const unwrapAction = <T>(result: ActionResult<T>): T => {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
};
