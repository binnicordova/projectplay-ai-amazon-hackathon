/**
 * Early reading in Spanish: hearing syllables, practising chosen syllables, reinforcing a sound
 * a child finds hard (the strong RR of pe-rro), and completing sentences.
 *
 * Every answer comes from `syllabify`, so "manzana" is never offered as starting with MA
 * (it is man-za-na).
 */
import type { Card, Level } from '@mimikai/contracts';
import { buildCards, cycle, icon, optionCount, orList, spoken, text, type ChoiceSpec, type GeneratorContext } from '../cards';
import { LEXICON, article, type Tag, type Word } from '../lexicon';
import { shuffle, type Random } from '../random';
import { clapped, firstSyllable, soundOf, soundPositions, syllabify } from '../syllables';

const upper = (s: string) => s.toUpperCase();
const firstSound = (word: Word) => soundOf(firstSyllable(word.es));

/** Common open syllables, for distractors when a teacher's list is short. */
const COMMON_SYLLABLES = ['ma', 'pa', 'sa', 'la', 'ta', 'me', 'pe', 'lo', 'mo', 'po', 'su', 'ca', 'no', 'mi', 'pi', 'ro', 'ga', 'va', 'co', 'bu'];

/**
 * Words whose first syllable sounds clearly different from every syllable in `taken`. MAN is
 * too close to MA for a 6-year-old (man-za-na sounds like it starts with "ma"), so it is out too.
 */
const differentStart = (words: readonly Word[], taken: readonly string[]) =>
  words.filter((w) => taken.every((t) => !firstSound(w).startsWith(t) && !t.startsWith(firstSound(w))));

/** Cycles through first syllables, then through the words of each: GA comes back only after every other syllable. */
function bySyllable(random: Random, words: readonly Word[]): () => Word | undefined {
  const groups = new Map<string, Word[]>();
  for (const word of words) groups.set(firstSound(word), [...(groups.get(firstSound(word)) ?? []), word]);
  const nextGroup = cycle(random, [...groups.values()].map((group) => cycle(random, group)));
  return () => nextGroup()?.();
}

export interface SyllableSoundsParams {
  /** Pictures to use ("granja" for farm animals). */
  readonly theme?: Tag;
}

/**
 * How syllables sound. Levels 1–2: the teacher says a syllable, children point at the picture
 * that starts with it. Level 3: children name a picture and choose its first syllable.
 */
export function syllableSoundCards({ theme = 'granja' }: SyllableSoundsParams, ctx: GeneratorContext): readonly Card[] {
  const words = LEXICON.filter((w) => w.tags.includes(theme));
  const pool = words.length >= 3 ? words : LEXICON.filter((w) => w.tags.includes('animal'));
  const nextWord = bySyllable(ctx.random, pool);
  const noun = theme === 'granja' || theme === 'animal' ? 'animal' : 'dibujo';
  return buildCards(ctx, (level): ChoiceSpec | null => {
    const word = nextWord();
    if (!word) return null;
    const syllable = firstSyllable(word.es);
    const options = optionCount(ctx.band, level);
    if (level === 3) {
      const others = shuffle(ctx.random, [...new Set(differentStart(pool, [firstSound(word)]).map((w) => firstSyllable(w.es)))]);
      return {
        level,
        prompt: { text: '¿Con qué sílaba empieza?', visual: icon(word.icon, word.es) },
        correct: text(upper(syllable)),
        distractors: others.map((s) => text(upper(s))),
        options,
        explain: `${clapped(word.es)}: empieza con ${upper(syllable)}.`,
        say: (tiles) => `Digan despacio «${clapped(word.es)}». ¿Empieza con ${orList(tiles.map(spoken))}?`,
      };
    }
    return {
      level,
      prompt: { text: `¿Qué ${noun} empieza con ${upper(syllable)}?`, visual: text(upper(syllable)), say: `Escuchen: «${syllable}». ¿Qué ${noun} empieza con «${syllable}»?` },
      correct: icon(word.icon, word.es),
      distractors: shuffle(ctx.random, differentStart(pool, [firstSound(word)])).map((w) => icon(w.icon, w.es)),
      options,
      explain: `${clapped(word.es)} empieza con ${upper(syllable)}.`,
    };
  });
}

export interface SyllablesParams {
  /** The syllables to practise, e.g. ["MA", "PA", "RO"]. */
  readonly syllables: readonly string[];
}

/**
 * Practise chosen syllables. Level 1: a picture's first syllable. Level 2: the missing syllable
 * in a word (__SA for rosa, MA__ for mapa). Level 3: which picture starts with a syllable.
 */
export function syllablePracticeCards({ syllables }: SyllablesParams, ctx: GeneratorContext): readonly Card[] {
  const targets = [...new Set(syllables.map(soundOf).filter((s) => s.length > 0))];
  if (targets.length === 0) return [];
  const starting = LEXICON.filter((w) => targets.includes(firstSound(w)));
  const containing = LEXICON.filter((w) => syllabify(w.es).length >= 2 && syllabify(w.es).some((s) => targets.includes(soundOf(s))));
  const extra = COMMON_SYLLABLES.filter((s) => !targets.includes(s));
  const syllableDistractors = (correct: string, random: Random) => [...shuffle(random, targets.filter((t) => t !== correct)), ...shuffle(random, extra)].map((s) => text(upper(s)));
  const nextStart = bySyllable(ctx.random, starting);
  const nextContaining = cycle(ctx.random, containing);
  const nextTarget = cycle(ctx.random, targets);
  return buildCards(ctx, (level): ChoiceSpec | null => {
    const options = optionCount(ctx.band, level);
    if (level === 2) {
      const word = nextContaining();
      if (!word) return null;
      const parts = syllabify(word.es);
      const gap = parts.findIndex((s) => targets.includes(soundOf(s)));
      const shown = parts.map((s, i) => (i === gap ? '__' : upper(s))).join('');
      return {
        level,
        prompt: { text: `¿Qué sílaba falta? ${shown}`, visual: icon(word.icon, word.es), say: `Es ${article(word)} ${word.es}. ¿Qué sílaba falta en ${shown.replace('__', '…')}?` },
        correct: text(upper(parts[gap]!)),
        distractors: syllableDistractors(soundOf(parts[gap]!), ctx.random),
        options,
        explain: `${clapped(word.es)}`,
      };
    }
    if (level === 3) {
      const target = nextTarget()!;
      const word = shuffle(ctx.random, starting.filter((w) => firstSound(w) === target))[0];
      if (!word) return null;
      return {
        level,
        prompt: { text: `¿Qué dibujo empieza con ${upper(target)}?`, visual: text(upper(target)), say: `¿Qué dibujo empieza con «${target}»?` },
        correct: icon(word.icon, word.es),
        distractors: shuffle(ctx.random, differentStart(LEXICON, targets.length > 1 ? [target] : targets)).map((w) => icon(w.icon, w.es)),
        options,
        explain: `${clapped(word.es)} empieza con ${upper(target)}.`,
      };
    }
    const word = nextStart();
    if (!word) return null;
    const syllable = firstSyllable(word.es);
    return {
      level,
      prompt: { text: '¿Con qué sílaba empieza?', visual: icon(word.icon, word.es), say: `¿Con qué sílaba empieza ${word.es}?` },
      correct: text(upper(syllable)),
      distractors: syllableDistractors(soundOf(syllable), ctx.random),
      options,
      explain: `${clapped(word.es)}: empieza con ${upper(syllable)}.`,
    };
  });
}

export interface SoundPracticeParams {
  /** The sound to reinforce, written as a syllable ("RO" also practises the RR of pe-rro). */
  readonly sound: string;
}

/**
 * Reinforce one sound a child finds hard. Every card has the class say the word clapped
 * out loud (pe-RRO) before pointing, which is the actual practice.
 * Level 1: find the picture that has the sound. Level 2: which of three has it.
 * Level 3: complete the word with the right syllable.
 */
export function soundPracticeCards({ sound }: SoundPracticeParams, ctx: GeneratorContext): readonly Card[] {
  const target = soundOf(sound);
  if (target.length === 0) return [];
  const withSound = LEXICON.filter((w) => soundPositions(w.es, target).length > 0);
  const without = LEXICON.filter((w) => !syllabify(w.es).some((s) => soundOf(s) === target) && !w.es.includes(target[0] === 'r' ? 'r' : target));
  const nextWord = cycle(ctx.random, withSound);
  const emphasise = (word: Word) =>
    syllabify(word.es)
      .map((s, i) => (soundPositions(word.es, target).includes(i) ? upper(s) : s))
      .join('-');
  return buildCards(ctx, (level): ChoiceSpec | null => {
    const word = nextWord();
    if (!word) return null;
    const options = optionCount(ctx.band, level);
    const repeat = `Repitan conmigo: «${emphasise(word)}».`;
    if (level === 3) {
      const parts = syllabify(word.es);
      const gap = soundPositions(word.es, target)[0] ?? 0;
      const shown = parts.map((s, i) => (i === gap ? '__' : upper(s))).join('');
      const correct = upper(parts[gap]!);
      return {
        level,
        prompt: { text: `Completa: ${shown}`, visual: icon(word.icon, word.es) },
        correct: text(correct),
        distractors: shuffle(ctx.random, COMMON_SYLLABLES.filter((s) => soundOf(s) !== target)).map((s) => text(upper(s))),
        options,
        explain: `${emphasise(word)}`,
        say: (tiles) => `${repeat} ¿Qué falta: ${orList(tiles.map(spoken))}?`,
      };
    }
    return {
      level,
      prompt: { text: level === 1 ? `¿Dónde está ${article(word)} ${word.es}?` : `¿Cuál tiene ${upper(target)}?`, visual: text(emphasise(word)) },
      correct: icon(word.icon, word.es),
      distractors: shuffle(ctx.random, without).map((w) => icon(w.icon, w.es)),
      options,
      explain: `${emphasise(word)}: ¡muy bien dicho!`,
      say: (tiles) =>
        level === 1 ? `${repeat} ¿Dónde está ${article(word)} ${word.es}?` : `Digan cada nombre: ${tiles.map(spoken).join(', ')}. ¿Cuál tiene «${target}»?`,
    };
  });
}

/** A sentence with a gap, its answer and two wrong words that do not fit. */
export interface SentenceItem {
  readonly level: Level;
  readonly sentence: string;
  readonly answer: string;
  readonly wrong: readonly [string, string];
  readonly icon: string;
}

/** Everyday sentences for 6–8-year-olds; the picture hints at the scene, not the missing word. */
export const SENTENCES: readonly SentenceItem[] = [
  { level: 1, sentence: 'La vaca nos da ___.', answer: 'leche', wrong: ['pan', 'miel'], icon: '1f404' },
  { level: 1, sentence: 'Las abejas hacen ___.', answer: 'miel', wrong: ['leche', 'pan'], icon: '1f41d' },
  { level: 1, sentence: 'El pez vive en el ___.', answer: 'agua', wrong: ['árbol', 'cielo'], icon: '1f41f' },
  { level: 1, sentence: 'Me lavo las manos con ___.', answer: 'jabón', wrong: ['arena', 'miel'], icon: '1f9fc' },
  { level: 1, sentence: 'El perro mueve la ___.', answer: 'cola', wrong: ['mesa', 'nube'], icon: '1f415' },
  { level: 1, sentence: 'De noche sale la ___.', answer: 'luna', wrong: ['flor', 'silla'], icon: '1f319' },
  { level: 1, sentence: 'La gallina pone ___.', answer: 'huevos', wrong: ['zapatos', 'piedras'], icon: '1f414' },
  { level: 2, sentence: 'Uso el ___ para escribir.', answer: 'lápiz', wrong: ['zapato', 'plátano'], icon: '270f' },
  { level: 2, sentence: 'Cuando llueve abro mi ___.', answer: 'paraguas', wrong: ['libro', 'maleta'], icon: '1f327' },
  { level: 2, sentence: 'El pájaro usa sus ___ para volar.', answer: 'alas', wrong: ['ruedas', 'aletas'], icon: '1f426' },
  { level: 2, sentence: 'El ___ es una fruta amarilla.', answer: 'plátano', wrong: ['tomate', 'queso'], icon: '1f34c' },
  { level: 2, sentence: 'Con los ojos podemos ___.', answer: 'ver', wrong: ['oler', 'oír'], icon: '1f441' },
  { level: 2, sentence: 'La tortuga camina muy ___.', answer: 'despacio', wrong: ['rápido', 'alto'], icon: '1f422' },
  { level: 2, sentence: 'El tren va por los ___.', answer: 'rieles', wrong: ['ríos', 'árboles'], icon: '1f686' },
  { level: 3, sentence: 'Las plantas necesitan agua y ___ para crecer.', answer: 'sol', wrong: ['hielo', 'arena'], icon: '1f331' },
  { level: 3, sentence: 'Si tengo frío, me pongo la ___.', answer: 'casaca', wrong: ['toalla', 'cuchara'], icon: '1f9e5' },
  { level: 3, sentence: 'Antes de comer, me lavo las ___.', answer: 'manos', wrong: ['orejas', 'rodillas'], icon: '270b' },
  { level: 3, sentence: 'En invierno hace ___ y en verano hace calor.', answer: 'frío', wrong: ['calor', 'ruido'], icon: '2744' },
  { level: 3, sentence: 'El volcán echa ___ y humo.', answer: 'lava', wrong: ['nieve', 'leche'], icon: '1f30b' },
  { level: 3, sentence: 'La llama vive en los ___.', answer: 'Andes', wrong: ['mares', 'techos'], icon: '1f999' },
  { level: 3, sentence: 'El girasol siempre mira hacia el ___.', answer: 'sol', wrong: ['suelo', 'río'], icon: '1f33b' },
];

/** Complete the sentence: read it with the class, then point at the word that fits. */
export function sentenceCards(ctx: GeneratorContext): readonly Card[] {
  const byLevel = (level: Level) => cycle(ctx.random, SENTENCES.filter((s) => s.level === level));
  const next = { 1: byLevel(1), 2: byLevel(2), 3: byLevel(3) } as const;
  return buildCards(ctx, (level): ChoiceSpec | null => {
    const item = next[level]();
    if (!item) return null;
    return {
      level,
      prompt: { text: item.sentence, visual: icon(item.icon), say: `Lean juntos: «${item.sentence.replace('___', '…')}» ¿Qué palabra falta?` },
      correct: text(item.answer),
      distractors: item.wrong.map(text),
      options: Math.min(3, optionCount(ctx.band, level)),
      explain: item.sentence.replace('___', item.answer.toUpperCase()),
    };
  });
}
