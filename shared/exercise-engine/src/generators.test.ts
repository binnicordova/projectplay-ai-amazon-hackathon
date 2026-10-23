import { AGE_BANDS, decodeLesson, visualText, type Card, type Lesson } from '@projectplay/contracts';
import { describe, expect, it } from 'vitest';
import { keyOf, levelsFor } from './cards';
import { LEXICON } from './lexicon';
import { initialOf } from './generators/letters';
import { EXERCISE_KINDS, generateCards, type ExerciseRequest } from './request';
import { firstSyllable, soundPositions } from './syllables';

const REQUESTS: Readonly<Record<ExerciseRequest['kind'], ExerciseRequest>> = {
  numbers: { kind: 'numbers', from: 1, to: 9 },
  compare: { kind: 'compare', max: 10 },
  letters: { kind: 'letters', from: 'a', to: 'm', theme: 'animal' },
  syllableSounds: { kind: 'syllableSounds', theme: 'granja' },
  syllables: { kind: 'syllables', syllables: ['MA', 'PA', 'RO'] },
  soundPractice: { kind: 'soundPractice', sound: 'RO' },
  completeSentence: { kind: 'completeSentence' },
  english: { kind: 'english' },
  fractions: { kind: 'fractions', big: true },
  equations: { kind: 'equations', traps: true },
  arithmetic: { kind: 'arithmetic', operation: 'multiplicacion', table: 9 },
};

const asLesson = (cards: readonly Card[]): Lesson => ({
  format: 1,
  id: 'test',
  title: 'test',
  subject: 'matematica',
  audience: { band: 'primaria' },
  source: 'starter',
  createdAt: '2026-10-22T00:00:00.000Z',
  cards,
});

const correctOf = (card: Card) => (card.kind === 'choice' ? card.options[card.answer]! : null);

describe('every generator, every age group, many seeds', () => {
  for (const kind of EXERCISE_KINDS) {
    for (const band of AGE_BANDS) {
      it(`${kind} · ${band}: valid lesson cards, easy to hard, unique tiles`, () => {
        for (let seed = 0; seed < 25; seed++) {
          const count = 3 + (seed % 14);
          const cards = generateCards(REQUESTS[kind], { band, count, seed });
          expect(cards.length).toBeGreaterThan(0);
          expect(cards.length).toBeLessThanOrEqual(count);
          expect(decodeLesson(JSON.parse(JSON.stringify(asLesson(cards)))).ok).toBe(true);
          const levels = cards.map((c) => c.level);
          expect([...levels].sort()).toEqual(levels);
          for (const card of cards) {
            if (card.kind !== 'choice') continue;
            expect(card.options.length).toBeGreaterThanOrEqual(2);
            expect(new Set(card.options.map(keyOf)).size).toBe(card.options.length);
            if (band === 'inicial') expect(card.options.length).toBeLessThanOrEqual(3);
          }
        }
      });
    }
  }

  it('is deterministic: same request and seed, same cards', () => {
    for (const kind of EXERCISE_KINDS) {
      expect(generateCards(REQUESTS[kind], { band: 'primaria', count: 9, seed: 7 })).toEqual(generateCards(REQUESTS[kind], { band: 'primaria', count: 9, seed: 7 }));
    }
  });

  it('spreads a lesson over three levels', () => {
    expect(levelsFor(8)).toEqual([1, 1, 1, 2, 2, 2, 3, 3]);
    expect(levelsFor(5)).toEqual([1, 1, 2, 2, 3]);
    expect(levelsFor(1)).toEqual([1]);
  });
});

describe('answer keys are computed, not guessed', () => {
  const byLabel = new Map(LEXICON.map((w) => [w.es, w]));

  it('counting: the group shown has as many pictures as the right number', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const card of generateCards(REQUESTS.numbers, { band: 'primaria', count: 9, seed })) {
        const right = correctOf(card)!;
        if (card.prompt.visual?.kind === 'group') expect(visualText(right)).toBe(String(card.prompt.visual.count));
        else expect(right.kind === 'group' && String(right.count)).toBe(card.prompt.visual && visualText(card.prompt.visual));
      }
    }
  });

  it('more or less: the right group is the biggest or the smallest', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const card of generateCards(REQUESTS.compare, { band: 'inicial', count: 10, seed })) {
        if (card.kind !== 'choice') continue;
        const counts = card.options.map((o) => (o.kind === 'group' ? o.count : NaN));
        const want = card.prompt.text.includes('más') ? Math.max(...counts) : Math.min(...counts);
        expect(counts[card.answer]).toBe(want);
        expect(counts.filter((c) => c === want)).toHaveLength(1);
      }
    }
  });

  it('first letters and first syllables match the pictured word', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const card of generateCards(REQUESTS.letters, { band: 'primaria', count: 13, seed })) {
        const pictured = card.prompt.visual?.kind === 'icon' ? card.prompt.visual.label : undefined;
        const right = correctOf(card)!;
        if (pictured) expect(visualText(right)).toBe(initialOf(pictured));
        else expect(right.kind === 'icon' && initialOf(right.label!)).toBe(visualText(card.prompt.visual!));
      }
      for (const card of generateCards(REQUESTS.syllables, { band: 'primaria', count: 5, seed })) {
        const pictured = card.prompt.visual?.kind === 'icon' ? card.prompt.visual.label : undefined;
        if (card.level === 1 && pictured) expect(visualText(correctOf(card)!)).toBe(firstSyllable(pictured).toUpperCase());
      }
    }
  });

  it('never offers a picture whose name starts like the target syllable (MAN is too close to MA)', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const card of generateCards(REQUESTS.syllables, { band: 'primaria', count: 9, seed })) {
        if (card.kind !== 'choice' || card.level !== 3) continue;
        const target = visualText(card.prompt.visual!).toLowerCase();
        const wrong = card.options.filter((_, i) => i !== card.answer).map((o) => (o.kind === 'icon' ? o.label! : ''));
        for (const label of wrong) expect(firstSyllable(label).startsWith(target)).toBe(false);
      }
    }
  });

  it('sound practice: the right picture has the strong sound, the others have no R at all', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const card of generateCards(REQUESTS.soundPractice, { band: 'inicial', count: 6, seed })) {
        if (card.kind !== 'choice' || card.level === 3) continue;
        card.options.forEach((option, i) => {
          const word = option.kind === 'icon' ? option.label! : '';
          if (i === card.answer) expect(soundPositions(word, 'ro').length).toBeGreaterThan(0);
          else expect(word.includes('r')).toBe(false);
        });
      }
    }
  });

  it('English: the right word is the translation of the picture', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const card of generateCards(REQUESTS.english, { band: 'primaria', count: 20, seed })) {
        const right = correctOf(card)!;
        if (card.prompt.visual?.kind === 'icon') expect(visualText(right)).toBe(byLabel.get(card.prompt.visual.label!)!.en);
        else expect(right.kind === 'icon' && byLabel.get(right.label!)!.en).toBe(visualText(card.prompt.visual!));
      }
    }
  });

  it('a lesson asking for 20 English words never repeats a word', () => {
    const cards = generateCards(REQUESTS.english, { band: 'primaria', count: 20, seed: 1 });
    const words = cards.map((c) => (c.prompt.visual ? visualText(c.prompt.visual) : ''));
    expect(new Set(words).size).toBe(20);
  });
});
