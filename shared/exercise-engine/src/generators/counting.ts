/** Counting: recognise how many (numbers) and decide where there is more or less (compare). */
import type { Card, Level } from '@projectplay/contracts';
import { buildCards, group, text, type ChoiceSpec, type GeneratorContext } from '../cards';
import { plural, wordsTagged, type Word } from '../lexicon';
import { randomInt, shuffle, type Random } from '../random';

const COUNTABLE = wordsTagged('contar');

const pickWord = (random: Random): Word => COUNTABLE[randomInt(random, 0, COUNTABLE.length - 1)]!;

const howMany = (word: Word) => `¿${word.gender === 'f' ? 'Cuántas' : 'Cuántos'} ${plural(word.es)} hay?`;

/** Nearby numbers make the best distractors: children who miscount land on n ± 1. */
function nearby(n: number, min: number, max: number, random: Random): readonly number[] {
  const near = [n - 1, n + 1, n - 2, n + 2, n + 3, n - 3].filter((x) => x >= min && x <= max && x !== n);
  return [...shuffle(random, near.slice(0, 2)), ...near.slice(2)];
}

export interface NumbersParams {
  readonly from: number;
  readonly to: number;
}

/**
 * Number recognition by counting. Level 1 counts small groups, level 2 the bigger numbers
 * of the range, level 3 turns it around: find the group that has N.
 */
export function numberCards({ from, to }: NumbersParams, ctx: GeneratorContext): readonly Card[] {
  const lo = Math.max(1, Math.min(from, to));
  const hi = Math.min(12, Math.max(from, to));
  const mid = Math.max(lo, Math.floor((lo + hi) / 2));
  const used = new Set<string>();
  const fresh = (level: Level): { n: number; word: Word } => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const n = level === 1 ? randomInt(ctx.random, lo, mid) : randomInt(ctx.random, level === 2 ? Math.min(mid + 1, hi) : lo, hi);
      const word = pickWord(ctx.random);
      const key = `${n}:${word.icon}:${level === 3}`;
      if (!used.has(key)) {
        used.add(key);
        return { n, word };
      }
    }
    return { n: randomInt(ctx.random, lo, hi), word: pickWord(ctx.random) };
  };
  return buildCards(ctx, (level): ChoiceSpec => {
    const { n, word } = fresh(level);
    // Groups of up to a dozen pictures are big tiles: two or three of them, never four.
    const options = level === 3 ? (ctx.band === 'inicial' ? 2 : 3) : optionsFor(ctx, level);
    if (level === 3) {
      return {
        level,
        prompt: { text: `¿Dónde hay ${n}?`, visual: text(String(n)), say: `Busquen el grupo que tiene ${n} ${plural(word.es)}.` },
        correct: group(word.icon, n),
        distractors: nearby(n, 1, 12, ctx.random).map((x) => group(word.icon, x)),
        options,
        explain: `Ese grupo tiene ${n}.`,
      };
    }
    return {
      level,
      prompt: { text: '¿Cuántos hay?', visual: group(word.icon, n), say: `Cuenten con el dedo: ${howMany(word).toLowerCase()}` },
      correct: text(String(n)),
      distractors: nearby(n, Math.max(0, lo - 1), hi + 1, ctx.random).map((x) => text(String(x))),
      options,
      explain: `Hay ${n}.`,
    };
  });
}

const optionsFor = (ctx: GeneratorContext, level: Level): number => (ctx.band === 'inicial' ? (level === 1 ? 2 : 3) : 3);

export interface CompareParams {
  /** Largest group. */
  readonly max: number;
}

/**
 * More or less: children count each group and point at the one with more (or fewer).
 * Level 1 groups differ a lot, level 2 by one or two, level 3 has three groups.
 */
export function compareCards({ max }: CompareParams, ctx: GeneratorContext): readonly Card[] {
  const top = Math.max(4, Math.min(12, max));
  return buildCards(ctx, (level, index): ChoiceSpec => {
    const word = pickWord(ctx.random);
    const more = index % 2 === 0;
    const counts = countsFor(level, top, ctx.random);
    const target = more ? Math.max(...counts) : Math.min(...counts);
    const others = counts.filter((c) => c !== target);
    const question = more ? '¿Dónde hay más?' : '¿Dónde hay menos?';
    return {
      level,
      prompt: { text: question, say: `Cuenten cada grupo. ${more ? '¿Dónde hay más' : '¿Dónde hay menos'} ${plural(word.es)}?` },
      correct: group(word.icon, target),
      distractors: others.map((c) => group(word.icon, c)),
      options: counts.length,
      explain: `${[...counts].sort((a, b) => a - b).join(', ')}: ${more ? 'más' : 'menos'} es ${target}.`,
    };
  });
}

function countsFor(level: Level, top: number, random: Random): readonly number[] {
  if (level === 1) {
    const a = randomInt(random, 1, Math.min(3, top - 3));
    return shuffle(random, [a, randomInt(random, a + 3, Math.min(top, a + 6))]);
  }
  if (level === 2) {
    const a = randomInt(random, 2, top - 2);
    return shuffle(random, [a, a + randomInt(random, 1, 2)]);
  }
  const all = shuffle(random, Array.from({ length: top }, (_, i) => i + 1));
  return all.slice(0, 3);
}
