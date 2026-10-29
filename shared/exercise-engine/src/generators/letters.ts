/**
 * Letter recognition. Two shapes, chosen by the teacher's request:
 * - letters alone (inicial): find a letter among different ones, then among look-alikes,
 *   then the first letter of a picture's name;
 * - letters with pictures in a range (e.g. a–m with animals): one picture per letter, then
 *   turned around (which animal starts with this letter?).
 */
import type { Card, Level } from '@mimikai/contracts';
import { buildCards, cycle, icon, optionCount, orList, spoken, text, type ChoiceSpec, type GeneratorContext } from '../cards';
import { LEXICON, foldWord, type Tag, type Word } from '../lexicon';
import { shuffle, type Random } from '../random';

export const ALPHABET = 'abcdefghijklmnñopqrstuvwxyz'.split('');

const NAMES: Readonly<Record<string, string>> = {
  a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'efe', g: 'ge', h: 'hache', i: 'i', j: 'jota', k: 'ka', l: 'ele', m: 'eme', n: 'ene',
  ñ: 'eñe', o: 'o', p: 'pe', q: 'cu', r: 'erre', s: 'ese', t: 'te', u: 'u', v: 'uve', w: 'uve doble', x: 'equis', y: 'ye', z: 'zeta',
};

/** Letters children mix up. A look-alike is the hardest distractor, so it comes in at level 2. */
const LOOK_ALIKES: readonly (readonly string[])[] = [
  ['m', 'n', 'w'],
  ['b', 'd', 'p'],
  ['p', 'q', 'b'],
  ['e', 'f', 'l'],
  ['c', 'o', 'g'],
  ['i', 'l', 't'],
  ['u', 'v', 'w'],
  ['o', 'q', 'd'],
  ['s', 'z', 'x'],
];

const VOWELS = ['a', 'e', 'i', 'o', 'u'];

const lookAlikesOf = (letter: string): readonly string[] => [...new Set(LOOK_ALIKES.filter((g) => g.includes(letter)).flat())].filter((l) => l !== letter);

/** The letter a word starts with in writing (the h in hipopótamo is silent but written). */
export const initialOf = (word: string): string => foldWord(word)[0] ?? '';

export interface LettersParams {
  /** First and last letter of the range, inclusive ("a" … "m"). */
  readonly from?: string;
  readonly to?: string;
  /** Use pictures of this kind ("animal") for every card. */
  readonly theme?: Tag;
  readonly uppercase?: boolean;
}

function lettersBetween(from = 'a', to = 'z'): readonly string[] {
  const start = ALPHABET.indexOf(from.toLowerCase());
  const end = ALPHABET.indexOf(to.toLowerCase());
  if (start < 0 || end < 0) return ALPHABET;
  return ALPHABET.slice(Math.min(start, end), Math.max(start, end) + 1);
}

const show = (letter: string, upper: boolean) => (upper ? letter.toUpperCase() : letter);

/** Letters for distractors: look-alikes first at higher levels, otherwise letters far from the target. */
function letterDistractors(target: string, level: Level, pool: readonly string[], random: Random): readonly string[] {
  const alike = lookAlikesOf(target);
  const others = shuffle(random, pool.filter((l) => l !== target && !alike.includes(l)));
  return level === 1 ? others : [...shuffle(random, alike), ...others];
}

export function letterCards(params: LettersParams, ctx: GeneratorContext): readonly Card[] {
  return params.theme ? pictureLetterCards(params, params.theme, ctx) : plainLetterCards(params, ctx);
}

/** Inicial: letters as shapes first (find the A), then the first letter of a picture. */
function plainLetterCards(params: LettersParams, ctx: GeneratorContext): readonly Card[] {
  const upper = params.uppercase ?? ctx.band === 'inicial';
  const range = lettersBetween(params.from, params.to);
  const vowels = range.filter((l) => VOWELS.includes(l));
  const easy = vowels.length >= 2 ? vowels : range;
  const consonants = range.filter((l) => !VOWELS.includes(l) && lookAlikesOf(l).length > 0);
  const startsWithEasy = LEXICON.filter((w) => easy.includes(initialOf(w.es)));
  const nextEasy = cycle(ctx.random, easy);
  const nextHard = cycle(ctx.random, consonants.length > 0 ? consonants : range);
  const nextWord = cycle(ctx.random, startsWithEasy);
  return buildCards(ctx, (level): ChoiceSpec | null => {
    const options = optionCount(ctx.band, level);
    if (level === 3 && startsWithEasy.length > 0) {
      const word = nextWord()!;
      const letter = initialOf(word.es);
      return {
        level,
        prompt: { text: '¿Con qué letra empieza?', visual: icon(word.icon, word.es), say: `¿Con qué letra empieza ${word.es}?` },
        correct: text(show(letter, upper)),
        distractors: letterDistractors(letter, 1, easy.length >= 3 ? easy : range, ctx.random).map((l) => text(show(l, upper))),
        options,
        explain: `${word.es} empieza con ${show(letter, upper)}.`,
      };
    }
    const letter = (level === 1 ? nextEasy() : nextHard())!;
    return {
      level,
      prompt: { text: `¿Dónde está la ${show(letter, upper)}?`, visual: text(show(letter, upper)), say: `Busquen la letra ${NAMES[letter] ?? letter}.` },
      correct: text(show(letter, upper)),
      distractors: letterDistractors(letter, level, ALPHABET, ctx.random).map((l) => text(show(l, upper))),
      options,
    };
  });
}

/** One picture per letter of the range (a–m with animals): first letter, then the other way round. */
function pictureLetterCards(params: LettersParams, theme: Tag, ctx: GeneratorContext): readonly Card[] {
  const upper = params.uppercase ?? false;
  const range = lettersBetween(params.from, params.to);
  const themed = LEXICON.filter((w) => w.tags.includes(theme) && range.includes(initialOf(w.es)));
  const byLetter = new Map<string, Word[]>();
  for (const word of shuffle(ctx.random, themed)) byLetter.set(initialOf(word.es), [...(byLetter.get(initialOf(word.es)) ?? []), word]);
  const letters = shuffle(ctx.random, [...byLetter.keys()]);
  const nextLetter = cycle(ctx.random, letters);
  return buildCards(ctx, (level): ChoiceSpec | null => {
    const letter = nextLetter();
    const word = letter ? byLetter.get(letter)?.[0] : undefined;
    if (!letter || !word) return null;
    const options = optionCount(ctx.band, level);
    if (level === 3) {
      const others = shuffle(ctx.random, themed.filter((w) => initialOf(w.es) !== letter));
      return {
        level,
        prompt: { text: `¿Qué ${theme === 'animal' ? 'animal' : 'dibujo'} empieza con ${show(letter, upper)}?`, visual: text(show(letter, upper)), say: `Busquen el que empieza con la letra ${NAMES[letter] ?? letter}.` },
        correct: icon(word.icon, word.es),
        distractors: others.map((w) => icon(w.icon, w.es)),
        options,
        explain: `${word.es} empieza con ${show(letter, upper)}.`,
        say: (tiles) => `¿Cuál empieza con la letra ${NAMES[letter] ?? letter}: ${orList(tiles.map(spoken))}?`,
      };
    }
    // A silent h sounds like the vowel after it: never offer that vowel as a trap for 6-year-olds.
    const silent = letter === 'h' ? [foldWord(word.es)[1] ?? ''] : [];
    return {
      level,
      prompt: { text: '¿Con qué letra empieza?', visual: icon(word.icon, word.es), say: `¿Con qué letra empieza ${word.es}?` },
      correct: text(show(letter, upper)),
      distractors: letterDistractors(letter, level, range, ctx.random)
        .filter((l) => !silent.includes(l))
        .map((l) => text(show(l, upper))),
      options,
      explain: `${word.es} empieza con ${show(letter, upper)}.`,
    };
  });
}
