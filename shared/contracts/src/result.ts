/**
 * A value or the reason there is none. Domain code returns results instead of throwing,
 * so every failure is visible in the types and handled where it can be explained.
 */
export type Result<T, E = string> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const mapResult = <T, U, E>(result: Result<T, E>, f: (value: T) => U): Result<U, E> => (result.ok ? ok(f(result.value)) : result);

export const flatMapResult = <T, U, E>(result: Result<T, E>, f: (value: T) => Result<U, E>): Result<U, E> => (result.ok ? f(result.value) : result);

/** All values, or the first error. */
export function allResults<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}

type Values<R> = { readonly [K in keyof R]: R[K] extends Result<infer T, unknown> ? T : never };

/**
 * An object of results becomes a result of an object. Keys whose value is `undefined`
 * (an absent optional field) are left out, so decoded data serialises like the input.
 */
export function struct<R extends Readonly<Record<string, Result<unknown, unknown>>>>(fields: R): Result<Values<R>, R[keyof R] extends Result<unknown, infer E> ? E : never> {
  const out: Record<string, unknown> = {};
  for (const [key, result] of Object.entries(fields)) {
    if (!result.ok) return result as never;
    if (result.value !== undefined) out[key] = result.value;
  }
  return ok(out as Values<R>);
}
