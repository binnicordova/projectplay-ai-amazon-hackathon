/** A seeded random source (mulberry32): the same class seed picks the same cards on every TV. */
export type Random = () => number;

export function seededRandom(...parts: readonly (number | string)[]): Random {
  let a = parts.reduce<number>((hash, part) => {
    let h = hash;
    for (const ch of String(part)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    return Math.imul(h ^ 0xff, 0x01000193) >>> 0;
  }, 0x811c9dc5);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
