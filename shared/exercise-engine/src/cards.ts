/**
 * Building blocks every generator shares: how many tiles an age group gets, how a lesson's
 * cards climb from easy to hard, and how one right answer and its distractors become a card.
 * Everything is a pure function of its inputs and a seeded random source.
 */
import type { AgeBand, Card, Level, Prompt, Visual } from '@projectplay/contracts';
import { shuffle, type Random } from './random';

export interface GeneratorContext {
  readonly band: AgeBand;
  /** How many cards the teacher asked for. */
  readonly count: number;
  readonly random: Random;
  /** Card ids: `${prefix}1`, `${prefix}2`, … */
  readonly idPrefix: string;
}

/**
 * Tiles per card. Pre-readers get two or three big pictures; secondary students four.
 * The TV lays them out per team, so fewer tiles also means bigger targets for small arms.
 */
const OPTIONS: Readonly<Record<AgeBand, Readonly<Record<Level, number>>>> = {
  inicial: { 1: 2, 2: 3, 3: 3 },
  primaria: { 1: 3, 2: 3, 3: 4 },
  secundaria: { 1: 4, 2: 4, 3: 4 },
};

export const optionCount = (band: AgeBand, level: Level): number => OPTIONS[band][level];

/** A lesson climbs: the first third easy, the next third medium, the rest hard ([1,1,1,2,2,2,3,3] for 8). */
export function levelsFor(count: number): readonly Level[] {
  const n = Math.max(0, Math.floor(count));
  const easy = Math.ceil(n / 3);
  const medium = Math.ceil((n - easy) / 2);
  return Array.from({ length: n }, (_, i): Level => (i < easy ? 1 : i < easy + medium ? 2 : 3));
}

/** Two options are the same if children would see the same thing. */
export function keyOf(visual: Visual): string {
  switch (visual.kind) {
    case 'text':
      return `t:${visual.text.trim().toLowerCase()}`;
    case 'icon':
      return `i:${visual.icon}`;
    case 'group':
      return `g:${visual.icon}:${visual.count}`;
  }
}

export const text = (value: string): Visual => ({ kind: 'text', text: value });
export const icon = (id: string, label?: string): Visual => (label ? { kind: 'icon', icon: id, label } : { kind: 'icon', icon: id });
export const group = (id: string, count: number): Visual => ({ kind: 'group', icon: id, count });

export interface ChoiceSpec {
  readonly level: Level;
  readonly prompt: Prompt;
  readonly correct: Visual;
  /** Candidates in order of preference; duplicates of the answer or of each other are skipped. */
  readonly distractors: readonly Visual[];
  /** Tiles on the card, answer included. */
  readonly options: number;
  readonly explain?: string;
  /** Builds what the teacher reads aloud once the tiles are in their final order. */
  readonly say?: (options: readonly Visual[]) => string;
}

/** One right answer, shuffled among distinct distractors. Null if fewer than two tiles are possible. */
export function choice(id: string, spec: ChoiceSpec, random: Random): Card | null {
  const seen = new Set([keyOf(spec.correct)]);
  const picked: Visual[] = [];
  for (const candidate of spec.distractors) {
    if (picked.length >= spec.options - 1) break;
    const key = keyOf(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(candidate);
  }
  if (picked.length === 0) return null;
  const options = shuffle(random, [spec.correct, ...picked]);
  const answer = options.findIndex((o) => keyOf(o) === keyOf(spec.correct));
  const prompt = spec.say ? { ...spec.prompt, say: spec.say(options) } : spec.prompt;
  return { kind: 'choice', id, level: spec.level, prompt, options, answer, ...(spec.explain ? { explain: spec.explain } : {}) };
}

/** Picks `n` distinct items in random order (fewer if there are not enough). */
export const pick = <T>(random: Random, items: readonly T[], n: number): readonly T[] => shuffle(random, items).slice(0, Math.max(0, n));

/** Cycles through `items` in a shuffled order, so a long lesson repeats only after using them all. */
export function cycle<T>(random: Random, items: readonly T[]): () => T | undefined {
  let queue: T[] = [];
  return () => {
    if (items.length === 0) return undefined;
    if (queue.length === 0) queue = [...shuffle(random, items)];
    return queue.shift();
  };
}

/** Builds `ctx.count` cards, one per level slot, dropping slots a generator cannot fill. */
export function buildCards(ctx: GeneratorContext, make: (level: Level, index: number) => ChoiceSpec | Card | null): readonly Card[] {
  return levelsFor(ctx.count).flatMap((level, index) => {
    const id = `${ctx.idPrefix}${index + 1}`;
    const made = make(level, index);
    if (made === null) return [];
    if ('kind' in made) return [{ ...made, id }];
    const card = choice(id, made, ctx.random);
    return card ? [card] : [];
  });
}

/** Spanish list: "a, b o c". */
export function orList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`;
}

/** What a tile says when read aloud. */
export function spoken(visual: Visual): string {
  switch (visual.kind) {
    case 'text':
      return `«${visual.text.toLowerCase()}»`;
    case 'icon':
      return visual.label ?? 'el dibujo';
    case 'group':
      return `el grupo de ${visual.count}`;
  }
}
