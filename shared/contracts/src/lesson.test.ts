import { describe, expect, it } from 'vitest';
import { answerText, decodeLesson, iconsOf, lessonProblems, visualKey, type Lesson } from './lesson';
import { SAMPLE_LESSON } from './testing/sampleLesson';

const roundTrip = (lesson: unknown) => decodeLesson(JSON.parse(JSON.stringify(lesson)));

describe('lesson files', () => {
  it('reads a valid lesson back exactly as written', () => {
    expect(roundTrip(SAMPLE_LESSON)).toEqual({ ok: true, value: SAMPLE_LESSON });
  });

  it('lists every icon once, from prompts and options', () => {
    expect(iconsOf(SAMPLE_LESSON)).toEqual(['1f986', '1f34e']);
  });

  it('describes the right answer in words', () => {
    expect(SAMPLE_LESSON.cards.map(answerText)).toEqual(['PA', '7 × [1f34e]', 'VERDADERO']);
  });

  it('treats options that look the same as duplicates', () => {
    expect(visualKey({ kind: 'text', text: ' Pa ' })).toBe(visualKey({ kind: 'text', text: 'pa' }));
    expect(visualKey({ kind: 'group', icon: '1f34e', count: 3 })).not.toBe(visualKey({ kind: 'group', icon: '1f34e', count: 4 }));
  });

  const broken: Array<[string, (l: Lesson) => unknown]> = [
    ['not an object', () => 'lesson'],
    ['an unknown format', (l) => ({ ...l, format: 2 })],
    ['an unknown subject', (l) => ({ ...l, subject: 'alquimia' })],
    ['no cards', (l) => ({ ...l, cards: [] })],
    ['a level outside 1–3', (l) => ({ ...l, cards: [{ ...l.cards[0], level: 4 }] })],
    ['one option only', (l) => ({ ...l, cards: [{ ...l.cards[0], options: [{ kind: 'text', text: 'PA' }] }] })],
    ['an answer pointing past the options', (l) => ({ ...l, cards: [{ ...l.cards[0], answer: 3 }] })],
    ['two identical options', (l) => ({ ...l, cards: [{ ...l.cards[0], options: [{ kind: 'text', text: 'PA' }, { kind: 'text', text: 'pa' }], answer: 0 }] })],
    ['an icon id that is not a code point', (l) => ({ ...l, cards: [{ ...l.cards[0], prompt: { text: 'x', visual: { kind: 'icon', icon: 'frog' } } }] })],
    ['a group of 50 pictures', (l) => ({ ...l, cards: [{ ...l.cards[1], options: [{ kind: 'group', icon: '1f34e', count: 50 }, { kind: 'group', icon: '1f34e', count: 2 }] }] })],
    ['a true/false card with a text answer', (l) => ({ ...l, cards: [{ ...l.cards[2], answer: 'si' }] })],
    ['two cards with the same id', (l) => ({ ...l, cards: [l.cards[0], { ...l.cards[1], id: 'c1' }] })],
    ['an empty title', (l) => ({ ...l, title: '  ' })],
  ];

  it.each(broken)('rejects a lesson with %s, without throwing', (_label, make) => {
    const result = roundTrip(make(SAMPLE_LESSON));
    expect(result.ok).toBe(false);
  });

  it('explains what is wrong', () => {
    const result = roundTrip({ ...SAMPLE_LESSON, cards: [{ ...SAMPLE_LESSON.cards[0], answer: 3 }] });
    expect(result.ok ? '' : result.error).toContain('missing option');
    expect(lessonProblems(SAMPLE_LESSON)).toEqual([]);
  });
});
