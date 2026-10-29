import type { Card, Lesson, Level, SessionConfig } from '@mimikai/contracts';
import { describe, expect, it } from 'vitest';
import { LEVEL_WINDOW, START_PROGRESS, afterRound, pickCard } from './progression';
import { seededRandom } from './random';
import { NO_STATS, applyRound, leader, pointsFor, starsFor } from './scoring';
import {
  FEEDBACK_MS,
  INITIAL_SESSION,
  questionTimeMs,
  reduceSession,
  roundResults,
  snapshotOf,
  summaryOf,
  type SessionEvent,
  type SessionState,
} from './session';

const card = (id: string, level: Level, answer = 0): Card => ({
  kind: 'choice',
  id,
  level,
  prompt: { text: `¿Pregunta ${id}?`, say: `Lean ${id}` },
  options: [
    { kind: 'text', text: 'uno' },
    { kind: 'text', text: 'dos' },
    { kind: 'text', text: 'tres' },
  ],
  answer,
});

const LESSON: Lesson = {
  format: 1,
  id: 'test-lesson',
  title: 'Prueba',
  subject: 'matematica',
  audience: { band: 'primaria', age: 7 },
  source: 'starter',
  createdAt: '2026-10-22T00:00:00.000Z',
  cards: [card('e1', 1), card('e2', 1), card('e3', 1), card('m1', 2), card('m2', 2), card('m3', 2), card('h1', 3), card('h2', 3), card('h3', 3)],
};

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({ lesson: LESSON, art: {}, rounds: 6, seed: 7, ...overrides });
const run = (events: readonly SessionEvent[], from: SessionState = INITIAL_SESSION) => events.reduce(reduceSession, from);
const TIME = questionTimeMs(config(), LESSON.cards[0]!);

function current(state: SessionState): Card {
  if (state.phase !== 'question' && state.phase !== 'feedback') throw new Error(`expected a round, got ${state.phase}`);
  return state.round.card;
}

/** Plays one round: each listed team answers right (true) or wrong (false) at `at` ms, then time runs out. */
function playRound(state: SessionState, answers: Partial<Record<'A' | 'B', boolean>>, at = 2000): SessionState {
  if (state.phase !== 'question') throw new Error(`expected a question, got ${state.phase}`);
  const c = current(state);
  const right = c.kind === 'choice' ? c.answer : 0;
  const start = state.round.startedAt;
  const events: SessionEvent[] = (Object.entries(answers) as Array<['A' | 'B', boolean]>).map(([team, ok]) => ({
    type: 'answer',
    team,
    value: ok ? right : (right + 1) % 3,
    now: start + at,
  }));
  const fed = run([...events, { type: 'tick', now: start + TIME }], state);
  return run([{ type: 'tick', now: start + TIME + FEEDBACK_MS }], fed);
}

describe('session reducer', () => {
  it('starts with an easy card and mirrors it to the phone', () => {
    const s = run([{ type: 'start', config: config(), now: 0 }]);
    expect(s.phase).toBe('question');
    expect(current(s).level).toBe(1);
    expect(snapshotOf(s)).toMatchObject({ phase: 'question', round: 1, rounds: 6, mode: 'choice', lessonId: 'test-lesson', level: 1, scores: { A: 0, B: 0 } });
    expect(snapshotOf(s).say).toMatch(/^Lean e/);
  });

  it('scores the choice each team holds when the time is up, not its first one', () => {
    const s0 = run([{ type: 'start', config: config(), now: 0 }]);
    const right = (current(s0) as Extract<Card, { kind: 'choice' }>).answer;
    const wrong = (right + 1) % 3;
    const s = run(
      [
        { type: 'answer', team: 'A', value: wrong, now: 1000 },
        { type: 'answer', team: 'A', value: right, now: 4000 },
        { type: 'answer', team: 'B', value: right, now: 2000 },
        { type: 'answer', team: 'B', value: wrong, now: 9000 },
        { type: 'tick', now: TIME },
      ],
      s0,
    );
    expect(s.phase).toBe('feedback');
    if (s.phase !== 'feedback') return;
    expect(s.outcome.points.A).toBe(pointsFor(1, 4000, TIME, 0));
    expect(s.outcome.points.B).toBe(0);
    expect(snapshotOf(s).scores).toEqual({ A: s.outcome.points.A, B: 0 });
    expect(roundResults(s)).toEqual([
      { t: 'result', round: 1, correct: true, team: 'A', ms: 4000, points: s.outcome.points.A },
      { t: 'result', round: 1, correct: false, team: 'B', ms: 9000, points: 0 },
    ]);
  });

  it('ignores answers outside the card, from absent teams, or of the wrong kind', () => {
    const s0 = run([{ type: 'start', config: config({ teams: 1 }), now: 0 }]);
    expect(run([{ type: 'answer', team: 'A', value: 7, now: 10 }], s0)).toBe(s0);
    expect(run([{ type: 'answer', team: 'A', value: true, now: 10 }], s0)).toBe(s0);
    expect(run([{ type: 'answer', team: 'B', value: 0, now: 10 }], s0)).toBe(s0);
  });

  it('climbs a level after two strong rounds, and comes back down after two weak ones', () => {
    let s = run([{ type: 'start', config: config({ rounds: 9 }), now: 0 }]);
    s = playRound(s, { A: true, B: true });
    s = playRound(s, { A: true, B: true });
    expect(current(s).level).toBe(2);
    s = playRound(s, { A: false, B: false });
    s = playRound(s, {});
    expect(current(s).level).toBe(1);
  });

  it('never plays the same card twice while the lesson has unplayed ones', () => {
    let s = run([{ type: 'start', config: config({ rounds: 9 }), now: 0 }]);
    const seen: string[] = [];
    for (let i = 0; i < 9; i++) {
      seen.push(current(s).id);
      if (i < 8) s = playRound(s, { A: i % 3 !== 0, B: true });
    }
    expect(new Set(seen).size).toBe(9);
  });

  it('ends after the requested cards (never more than the lesson has) with the class standings', () => {
    let s = run([{ type: 'start', config: config({ rounds: 2, teams: 2, record: 50 }), now: 0 }]);
    s = playRound(s, { A: true, B: false });
    s = playRound(s, { A: true, B: true });
    expect(s.phase).toBe('summary');
    if (s.phase !== 'summary') return;
    expect(snapshotOf(s)).toMatchObject({ phase: 'summary', round: 2, rounds: 2 });
    const view = summaryOf(s);
    expect(view.winner).toBe('A');
    expect(view.title).toBe('¡Gana el equipo A!');
    expect(view.newRecord).toBe(true);
    expect(snapshotOf(run([{ type: 'start', config: config({ rounds: 99 }), now: 0 }])).rounds).toBe(LESSON.cards.length);
  });

  it('gives a player alone stars and tells them when they did not beat the record', () => {
    let s = run([{ type: 'start', config: config({ rounds: 2, teams: 1, record: 10_000 }), now: 0 }]);
    s = playRound(s, { A: true });
    s = playRound(s, { A: true });
    if (s.phase !== 'summary') throw new Error('expected the summary');
    expect(summaryOf(s)).toMatchObject({ stars: 3, winner: null, newRecord: false, title: '¡Perfecto!' });
  });

  it('lets the teacher skip ahead and end the class at any time', () => {
    const s0 = run([{ type: 'start', config: config(), now: 0 }]);
    const skipped = run([{ type: 'next', now: 100 }], s0);
    expect(skipped.phase).toBe('feedback');
    expect(run([{ type: 'next', now: 200 }], skipped).phase).toBe('question');
    const ended = run([{ type: 'end' }], s0);
    expect(ended.phase).toBe('summary');
    expect(run([{ type: 'end' }], ended)).toBe(INITIAL_SESSION);
  });

  it('keeps the same state object on idle ticks', () => {
    const s0 = run([{ type: 'start', config: config(), now: 0 }]);
    expect(run([{ type: 'tick', now: 500 }], s0)).toBe(s0);
  });
});

describe('progression', () => {
  it('waits for a full window of rounds before moving', () => {
    const one = afterRound(START_PROGRESS, 2, 2);
    expect(one.change).toBeNull();
    expect(afterRound(one.progress, 2, 2).change).toBe('up');
    expect(LEVEL_WINDOW).toBe(2);
  });

  it('does not move a mixed class (one team right, one wrong)', () => {
    const p = afterRound(afterRound(START_PROGRESS, 1, 2).progress, 1, 2);
    expect(p.change).toBeNull();
    expect(p.progress.level).toBe(1);
  });

  it('falls back to the nearest level with fresh cards, then to the card played longest ago', () => {
    const random = seededRandom(1);
    const easyPlayed = ['e1', 'e2', 'e3'];
    expect(pickCard(LESSON, 1, easyPlayed, random).level).toBe(2);
    const all = LESSON.cards.map((c) => c.id);
    expect(pickCard(LESSON, 3, all, random).id).toBe('h1');
  });
});

describe('scoring', () => {
  it('pays more for harder cards, quick final choices and streaks', () => {
    expect(pointsFor(1, TIME, TIME, 0)).toBe(100);
    expect(pointsFor(3, TIME, TIME, 0)).toBe(200);
    expect(pointsFor(1, 0, TIME, 0)).toBe(150);
    expect(pointsFor(1, TIME, TIME, 2)).toBe(150);
    expect(pointsFor(1, TIME, TIME, 10)).toBe(200);
  });

  it('never takes points away, and resets the streak on a miss', () => {
    const hot = applyRound(applyRound(NO_STATS, true, 120), true, 130);
    expect(hot).toEqual({ points: 250, correct: 2, streak: 2, bestStreak: 2 });
    expect(applyRound(hot, false, 0)).toEqual({ points: 250, correct: 2, streak: 0, bestStreak: 2 });
    expect(applyRound(hot, null, 0).streak).toBe(0);
  });

  it('always gives at least one star, and names a leader only when there is one', () => {
    expect([starsFor(0, 5), starsFor(3, 5), starsFor(5, 5)]).toEqual([1, 2, 3]);
    expect(leader({ A: { ...NO_STATS, points: 10 }, B: { ...NO_STATS, points: 10 } })).toBeNull();
    expect(leader({ A: NO_STATS, B: { ...NO_STATS, points: 5 } })).toBe('B');
  });
});
