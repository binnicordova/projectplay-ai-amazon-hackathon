/**
 * Keyframes in time, for scenes and shows that move several actors at once (Rayitas, its hoops,
 * the energy ball). Each value is a list of [ms, value] keys; an app plays them with one native
 * clock and straight lines between keys, so extra keys stand in for easing curves.
 */

/** Keys in milliseconds from the start: `t` non-decreasing, `v` the value at each. */
export interface Keyed {
  readonly t: readonly number[];
  readonly v: readonly number[];
}

export const still = (value: number): Keyed => ({ t: [0], v: [value] });

/** Builds keys from [ms, value] pairs. */
export const keyed = (pairs: readonly (readonly [number, number])[]): Keyed => ({ t: pairs.map(([t]) => t), v: pairs.map(([, v]) => v) });

/** The value at `ms`, straight lines between keys, held before the first and after the last. */
export function keyAt(keys: Keyed, ms: number): number {
  const { t, v } = keys;
  if (ms <= t[0]!) return v[0]!;
  for (let i = 1; i < t.length; i++) {
    if (ms <= t[i]!) {
      const t0 = t[i - 1]!;
      const t1 = t[i]!;
      return ms === t1 || t1 === t0 ? v[i]! : v[i - 1]! + ((v[i]! - v[i - 1]!) * (ms - t0)) / (t1 - t0);
    }
  }
  return v[v.length - 1]!;
}

export const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));
/** Progress 0..1 of `t` through the span a..b. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const easeOut = (k: number): number => 1 - (1 - k) ** 3;
export const easeIn = (k: number): number => k ** 3;
export const easeInOut = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
/** 0 → 1 → 0 over k = 0..1. */
export const bump = (k: number): number => Math.sin(Math.PI * clamp01(k));

/** Deterministic 0..1 noise for index `i`: shows look lively but are the same every class (and in tests). */
export function noise(i: number, salt = 0): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Samples a function of time into keys every `stepMs`, ending exactly at `ms`. */
export function sampled(ms: number, stepMs: number, at: (t: number) => number): Keyed {
  const steps = Math.max(1, Math.round(ms / stepMs));
  const t = Array.from({ length: steps + 1 }, (_, i) => (i * ms) / steps);
  return { t, v: t.map(at) };
}
