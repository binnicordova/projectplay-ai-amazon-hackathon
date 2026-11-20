import { describe, expect, it } from 'vitest';
import {
  NO_PROGRESS,
  decodeProgress,
  momentsOf,
  nextRingIn,
  previousSchoolDay,
  reduceProgress,
  ringsOf,
  streakOf,
  type FinishedClass,
  type MimiEvent,
  type MimiProgress,
} from './progress';
import { chatCueOf, homeCueOf, momentView } from './voice';

const finished = (overrides: Partial<FinishedClass> = {}): MimiEvent => ({
  type: 'classFinished',
  finished: { day: '2026-11-02', rounds: 6, teams: 1, correct: 4, level: 2, ...overrides },
});
const play = (progress: MimiProgress, events: readonly MimiEvent[]) => events.reduce(reduceProgress, progress);

describe('the school-day streak', () => {
  // 2026-11-02 is a Monday.
  it('steps back over weekends', () => {
    expect(previousSchoolDay('2026-11-02')).toBe('2026-10-30');
    expect(previousSchoolDay('2026-11-03')).toBe('2026-11-02');
  });

  it('counts school days in a row with a class; a weekend never breaks it', () => {
    expect(streakOf(['2026-10-29', '2026-10-30', '2026-11-02'], '2026-11-02')).toBe(3);
    expect(streakOf(['2026-10-28', '2026-10-30', '2026-11-02'], '2026-11-02')).toBe(2);
  });

  it('stays alive until today ends, and breaks after a school day without a class', () => {
    expect(streakOf(['2026-10-30'], '2026-11-02')).toBe(1);
    expect(streakOf(['2026-10-30'], '2026-11-03')).toBe(0);
    expect(streakOf(['2026-10-30'], '2026-11-01')).toBe(1);
  });
});

describe("Mimi's progress", () => {
  it('counts finished classes, right answers and the hardest level', () => {
    const p = play(NO_PROGRESS, [finished({ correct: 4, level: 2 }), finished({ correct: 3, level: 3, day: '2026-11-03' })]);
    expect(p).toMatchObject({ classes: 2, rightAnswers: 7, topLevel: 3, days: ['2026-11-02', '2026-11-03'], bestStreak: 2 });
  });

  it('ignores a class ended before its first card', () => {
    expect(reduceProgress(NO_PROGRESS, finished({ rounds: 0 }))).toBe(NO_PROGRESS);
  });

  it('juggles one more ring at 3, 8, 15 and 25 classes', () => {
    const after = (n: number) => play(NO_PROGRESS, Array.from({ length: n }, () => finished()));
    expect(ringsOf(NO_PROGRESS)).toBe(1);
    expect([2, 3, 8, 15, 25].map((n) => ringsOf(after(n)))).toEqual([1, 2, 3, 4, 5]);
    expect(nextRingIn(after(4))).toBe(4);
    expect(nextRingIn(after(25))).toBeNull();
  });

  it('unlocks achievements once, in order', () => {
    const first = play(NO_PROGRESS, [finished({ correct: 6 })]);
    expect(first.achievements).toEqual(['firstClass', 'perfectClass']);
    const created = reduceProgress(first, { type: 'lessonCreated', day: '2026-11-02' });
    expect(created.achievements).toEqual(['firstClass', 'perfectClass', 'firstLesson']);
    expect(reduceProgress(created, finished({ correct: 6 })).achievements).toHaveLength(3);
  });

  it('counts a two-team class as perfect only when both teams got every card', () => {
    expect(reduceProgress(NO_PROGRESS, finished({ teams: 2, correct: 6 })).perfectClasses).toBe(0);
    expect(reduceProgress(NO_PROGRESS, finished({ teams: 2, correct: 12 })).perfectClasses).toBe(1);
  });

  it('celebrates the class, then a new ring, then each new achievement', () => {
    const before = play(NO_PROGRESS, [finished(), finished({ day: '2026-11-03' })]);
    const event = finished({ day: '2026-11-04', correct: 6 });
    const after = reduceProgress(before, event);
    expect(momentsOf(before, after, event)).toEqual([
      { kind: 'classDone', correct: 6, asked: 6, streak: 3 },
      { kind: 'ring', rings: 2 },
      { kind: 'achievement', id: 'perfectClass' },
    ]);
  });

  it('starts over instead of crashing on a damaged file', () => {
    expect(decodeProgress('nonsense')).toEqual(NO_PROGRESS);
    expect(decodeProgress({ classes: 4, topLevel: 9, days: ['2026-11-02', 'x'], achievements: ['firstClass', 'made-up'] })).toMatchObject({
      classes: 4,
      topLevel: 1,
      days: ['2026-11-02'],
      achievements: ['firstClass'],
    });
  });
});

describe("Mimi's voice", () => {
  it('invites the teacher to connect the TV, and to play once it is', () => {
    expect(homeCueOf({ tvConnected: false, classes: 0 }).line).toMatch(/Soy Mimi/);
    expect(homeCueOf({ tvConnected: true, classes: 3 })).toMatchObject({ mood: 'hello', line: '¡La TV está lista! ¿Jugamos?' });
  });

  it('thinks while a lesson is drafted and cheers every new draft', () => {
    expect(chatCueOf({ state: 'thinking', drafts: 0 }).mood).toBe('think');
    const first = chatCueOf({ state: 'idle', drafts: 1 });
    expect(first.mood).toBe('gotIt');
    expect(chatCueOf({ state: 'idle', drafts: 2 }).key).not.toBe(first.key);
    expect(chatCueOf({ state: 'idle', drafts: 0 }).mood).toBe('waiting');
  });

  it('says what each celebration is about', () => {
    expect(momentView({ kind: 'classDone', correct: 5, asked: 6, streak: 3 }, 2, 0)).toMatchObject({
      title: '¡Clase terminada!',
      detail: '5 de 6 respuestas correctas · Racha: 3 días seguidos',
    });
    expect(momentView({ kind: 'ring', rings: 3 }, 2, 1)).toMatchObject({ rings: 3, cue: { mood: 'levelUp' } });
    expect(momentView({ kind: 'achievement', id: 'level3' }, 2, 2)).toMatchObject({ title: '¡Logro: Nivel 3!', icon: '1f680' });
  });
});
