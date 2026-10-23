/**
 * First English words: a picture and its English name. Levels 1–2 go from the picture to the
 * word (level 2 with words of the same kind, dog / cat / cow); level 3 from the word to the
 * picture, which children must read.
 */
import type { Card } from '@projectplay/contracts';
import { buildCards, cycle, icon, optionCount, text, type ChoiceSpec, type GeneratorContext } from '../cards';
import { LEXICON, foldWord, type Tag, type Word } from '../lexicon';
import { shuffle } from '../random';

type English = Word & { readonly en: string };

const KINDS: readonly Tag[] = ['animal', 'fruta', 'comida', 'cosa', 'naturaleza', 'transporte'];

/** Short words that differ from the Spanish one ("robot" or "llama" teach nothing). */
const ENGLISH: readonly English[] = LEXICON.filter(
  (w): w is English => w.en !== undefined && w.en.length <= 9 && !w.en.includes(' ') && w.en !== foldWord(w.es),
);

const kindOf = (word: Word): Tag => KINDS.find((k) => word.tags.includes(k)) ?? 'cosa';

export interface EnglishParams {
  /** Only words of this kind ("animal"); all kinds when absent. */
  readonly theme?: Tag;
}

export function englishCards({ theme }: EnglishParams, ctx: GeneratorContext): readonly Card[] {
  const themed = theme ? ENGLISH.filter((w) => w.tags.includes(theme)) : ENGLISH;
  const pool = themed.length >= 4 ? themed : ENGLISH;
  // The most familiar words (shortest) come first.
  const ordered = [...pool].sort((a, b) => a.en.length - b.en.length);
  const easy = cycle(ctx.random, ordered.slice(0, Math.max(8, Math.ceil(ordered.length / 2))));
  const any = cycle(ctx.random, pool);
  const used = new Set<string>();
  const fresh = (next: () => English | undefined): English | undefined => {
    for (let i = 0; i < pool.length; i++) {
      const word = next();
      if (word && !used.has(word.en)) {
        used.add(word.en);
        return word;
      }
    }
    return next();
  };
  return buildCards(ctx, (level): ChoiceSpec | null => {
    const word = fresh(level === 1 ? easy : any);
    if (!word) return null;
    const options = optionCount(ctx.band, level);
    const sameKind = shuffle(ctx.random, pool.filter((w) => w.en !== word.en && kindOf(w) === kindOf(word)));
    const otherKind = shuffle(ctx.random, pool.filter((w) => w.en !== word.en && kindOf(w) !== kindOf(word)));
    if (level === 3) {
      return {
        level,
        prompt: { text: `¿Cuál es «${word.en}»?`, visual: text(word.en), say: `Lean en voz alta: «${word.en}». ¿Cuál es?` },
        correct: icon(word.icon, word.es),
        distractors: [...sameKind, ...otherKind].map((w) => icon(w.icon, w.es)),
        options,
        explain: `${word.en} = ${word.es}`,
      };
    }
    const distractors = level === 1 ? [...otherKind, ...sameKind] : [...sameKind, ...otherKind];
    return {
      level,
      prompt: { text: '¿Cómo se dice en inglés?', visual: icon(word.icon, word.es), say: `¿Cómo se dice ${word.es} en inglés?` },
      correct: text(word.en),
      distractors: distractors.map((w) => text(w.en)),
      options,
      explain: `${word.es} = ${word.en}`,
    };
  });
}
