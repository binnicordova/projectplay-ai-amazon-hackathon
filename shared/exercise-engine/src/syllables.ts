/**
 * Spanish syllable division, rule-based (no dictionary): Spanish spelling follows a handful of
 * regular rules, so an answer key built from this is checkable, unlike an AI's guess.
 *
 * - ch, ll, rr are one consonant; qu and gu before e/i are one consonant (que-so, ju-gue-te).
 * - Two strong vowels (a, e, o) or an accented í/ú next to a vowel are split (le-ón, dí-a).
 * - Between vowels: one consonant opens the next syllable (pa-to); two are split unless they
 *   are an inseparable pair like pr, bl, tr (ca-bra); three or four keep the inseparable pair
 *   together at the start of the next syllable (ins-truc-ción).
 * - y is a vowel at the end of a word or before a consonant (rey, muy).
 */

const STRONG = new Set(['a', 'e', 'o', 'á', 'é', 'ó']);
const WEAK = new Set(['i', 'u', 'ü', 'y']);
const ACCENTED_WEAK = new Set(['í', 'ú']);
const VOWEL_LETTERS = new Set([...STRONG, ...WEAK, ...ACCENTED_WEAK]);
const INSEPARABLE = new Set(['pr', 'br', 'tr', 'dr', 'cr', 'kr', 'gr', 'fr', 'pl', 'bl', 'cl', 'kl', 'gl', 'fl']);

interface Unit {
  readonly text: string;
  readonly vowel: boolean;
}

function units(word: string): readonly Unit[] {
  const out: Unit[] = [];
  let i = 0;
  while (i < word.length) {
    const pair = word.slice(i, i + 2);
    const after = word[i + 2];
    if (pair === 'ch' || pair === 'll' || pair === 'rr') {
      out.push({ text: pair, vowel: false });
      i += 2;
    } else if ((pair === 'qu' || pair === 'gu') && after !== undefined && 'eiéí'.includes(after)) {
      out.push({ text: pair, vowel: false });
      i += 2;
    } else {
      const letter = word[i]!;
      if (letter === 'y') {
        const next = word[i + 1];
        out.push({ text: letter, vowel: i > 0 && (next === undefined || !VOWEL_LETTERS.has(next)) });
      } else {
        out.push({ text: letter, vowel: VOWEL_LETTERS.has(letter) });
      }
      i += 1;
    }
  }
  return out;
}

function isHiatus(a: string, b: string): boolean {
  if (STRONG.has(a) && STRONG.has(b)) return true;
  if (ACCENTED_WEAK.has(a) || ACCENTED_WEAK.has(b)) return true;
  return a === b;
}

/** Index of the unit where the syllable after the vowel group ending at `end` begins. */
function cutBefore(us: readonly Unit[], end: number, nextStart: number): number {
  const consonants = us.slice(end + 1, nextStart).map((u) => u.text);
  switch (consonants.length) {
    case 0:
      return nextStart;
    case 1:
      return nextStart - 1;
    case 2:
      return INSEPARABLE.has(consonants.join('')) ? nextStart - 2 : nextStart - 1;
    case 3:
      return INSEPARABLE.has(consonants[1]! + consonants[2]!) ? nextStart - 2 : nextStart - 1;
    default:
      return nextStart - 2;
  }
}

/** "mariposa" → ["ma", "ri", "po", "sa"]; "perro" → ["pe", "rro"]. Lowercase, accents kept. */
export function syllabify(word: string): readonly string[] {
  const lower = word.trim().toLowerCase();
  if (!/^[a-záéíóúüñ]+$/.test(lower)) return lower ? [lower] : [];
  const us = units(lower);
  const nuclei: Array<readonly [number, number]> = [];
  for (let i = 0; i < us.length; ) {
    if (!us[i]!.vowel) {
      i += 1;
      continue;
    }
    let end = i;
    while (end + 1 < us.length && us[end + 1]!.vowel && !isHiatus(us[end]!.text, us[end + 1]!.text)) end += 1;
    nuclei.push([i, end]);
    i = end + 1;
  }
  if (nuclei.length <= 1) return [lower];
  const cuts = nuclei.slice(1).map(([start], k) => cutBefore(us, nuclei[k]![1], start));
  const bounds = [0, ...cuts, us.length];
  return bounds.slice(0, -1).map((from, k) =>
    us
      .slice(from, bounds[k + 1])
      .map((u) => u.text)
      .join(''),
  );
}

export const firstSyllable = (word: string): string => syllabify(word)[0] ?? '';

/** "pe-rro" style, for teachers to clap the word with the class. */
export const clapped = (word: string): string => syllabify(word).join('-');

/** Compare syllables by sound in writing: accents dropped, "rr" read as "r" (pe-RRO practises RO). */
export function soundOf(syllable: string): string {
  const map: Readonly<Record<string, string>> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' };
  return syllable
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/^rr/, 'r');
}

/**
 * Where a word contains a syllable that sounds like `sound` (e.g. "ro"). For an R sound, only
 * the strong R counts: rr (pe-rro) or an r that starts the word (ro-sa); to-ro has a soft r.
 */
export function soundPositions(word: string, sound: string): readonly number[] {
  const target = soundOf(sound);
  const parts = syllabify(word);
  return parts.flatMap((part, i) => {
    if (soundOf(part) !== target) return [];
    if (target.startsWith('r') && !(part.startsWith('rr') || i === 0 || /[nls]$/.test(parts[i - 1] ?? ''))) return [];
    return [i];
  });
}
