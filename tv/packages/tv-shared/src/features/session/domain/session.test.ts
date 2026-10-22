import type { SessionConfig } from '@projectplay/contracts';
import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_MS,
  INITIAL_SESSION,
  QUESTION_TIME_MS,
  reduceSession,
  roundResults,
  snapshotOf,
  summaryTitle,
  type SessionEvent,
  type SessionState,
} from './session';

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({ skill: 'addition', mode: 'choice', rounds: 2, seed: 7, ...overrides });
const run = (events: SessionEvent[], from: SessionState = INITIAL_SESSION) => events.reduce(reduceSession, from);

function question(state: SessionState) {
  if (state.phase !== 'question' && state.phase !== 'feedback') throw new Error(`expected a round, got ${state.phase}`);
  return state.round.question;
}

describe('session reducer', () => {
  it('starts in the lobby and opens round 1 on start', () => {
    const s = run([{ type: 'start', config: config(), now: 0 }]);
    expect(s.phase).toBe('question');
    expect(snapshotOf(s)).toMatchObject({ phase: 'question', round: 1, rounds: 2, mode: 'choice' });
    expect(snapshotOf(s).prompt).toContain('?');
  });

  it('scores the choice each team holds when the time is up, not its first one', () => {
    const start = run([{ type: 'start', config: config(), now: 0 }]);
    const answer = question(start).answer;
    const wrong = question(start).options.find((o) => o !== answer)!;
    const s = run(
      [
        { type: 'answer', team: 'A', value: wrong, now: 1000 },
        { type: 'answer', team: 'A', value: answer, now: 4000 },
        { type: 'answer', team: 'B', value: answer, now: 2000 },
        { type: 'answer', team: 'B', value: wrong, now: 9000 },
        { type: 'tick', now: QUESTION_TIME_MS.choice },
      ],
      start,
    );
    expect(s.phase).toBe('feedback');
    expect(snapshotOf(s).scores).toEqual({ A: 1, B: 0 });
    expect(roundResults(s)).toEqual([
      { t: 'result', round: 1, correct: true, team: 'A', ms: 4000 },
      { t: 'result', round: 1, correct: false, team: 'B', ms: 9000 },
    ]);
  });

  it('keeps the question open after both teams chose, so they can still change their minds', () => {
    const start = run([{ type: 'start', config: config(), now: 0 }]);
    const s = run(
      [
        { type: 'answer', team: 'A', value: question(start).answer, now: 500 },
        { type: 'answer', team: 'B', value: question(start).answer, now: 600 },
        { type: 'tick', now: QUESTION_TIME_MS.choice - 1 },
      ],
      start,
    );
    expect(s.phase).toBe('question');
  });

  it('lets the teacher end the question early with Next', () => {
    const start = run([{ type: 'start', config: config(), now: 0 }]);
    const s = run([{ type: 'answer', team: 'B', value: question(start).answer, now: 500 }, { type: 'next', now: 600 }], start);
    expect(s.phase).toBe('feedback');
    expect(snapshotOf(s).scores).toEqual({ A: 0, B: 1 });
  });

  it('times out, reports "time up", then advances to the next round and the summary', () => {
    let s = run([{ type: 'start', config: config(), now: 0 }]);
    s = run([{ type: 'tick', now: QUESTION_TIME_MS.choice }], s);
    expect(s.phase).toBe('feedback');
    expect(roundResults(s)).toEqual([{ t: 'result', round: 1, correct: false, team: null, ms: QUESTION_TIME_MS.choice }]);
    s = run([{ type: 'tick', now: QUESTION_TIME_MS.choice + FEEDBACK_MS }], s);
    expect(snapshotOf(s)).toMatchObject({ phase: 'question', round: 2 });
    s = run([{ type: 'next', now: 30_000 }, { type: 'next', now: 30_001 }], s);
    expect(s.phase).toBe('summary');
    expect(run([{ type: 'end' }], s).phase).toBe('lobby');
  });

  it('plays true/false with booleans and ignores numbers', () => {
    const start = run([{ type: 'start', config: config({ mode: 'trueFalse' }), now: 0 }]);
    const truth = question(start).statement.isTrue;
    const s = run(
      [
        { type: 'answer', team: 'A', value: 3, now: 100 },
        { type: 'answer', team: 'A', value: truth, now: 200 },
        { type: 'tick', now: QUESTION_TIME_MS.trueFalse },
      ],
      start,
    );
    expect(snapshotOf(s).scores.A).toBe(1);
    expect(snapshotOf(start).prompt).not.toContain('?');
  });

  it('gets harder after a perfect round and easier after a missed one', () => {
    let s = run([{ type: 'start', config: config({ rounds: 5 }), now: 0 }]);
    const levelOf = (x: SessionState) => (x.phase === 'question' || x.phase === 'feedback' ? x.level : 0);
    const start = levelOf(s);
    s = run([{ type: 'answer', team: 'A', value: question(s).answer, now: 10 }, { type: 'next', now: 20 }], s);
    expect(levelOf(s)).toBe(start + 1);
    s = run([{ type: 'next', now: 30 }], s);
    const wrong = question(s).options.find((o) => o !== question(s).answer)!;
    s = run([{ type: 'answer', team: 'A', value: wrong, now: 40 }, { type: 'next', now: 50 }], s);
    expect(levelOf(s)).toBe(start);
  });

  it('keeps the same state object on idle ticks and repeated choices (no needless re-renders)', () => {
    const start = run([{ type: 'start', config: config(), now: 0 }]);
    expect(reduceSession(start, { type: 'tick', now: 1000 })).toBe(start);
    const answered = run([{ type: 'answer', team: 'A', value: question(start).answer, now: 10 }], start);
    // Holding on the chosen tile again keeps the choice, and the time it was made.
    expect(reduceSession(answered, { type: 'answer', team: 'A', value: question(start).answer, now: 20 })).toBe(answered);
  });

  it('ends the class early to the summary and keeps the scores', () => {
    const start = run([{ type: 'start', config: config(), now: 0 }]);
    const s = run([{ type: 'answer', team: 'A', value: question(start).answer, now: 1 }, { type: 'next', now: 2 }, { type: 'end' }], start);
    expect(snapshotOf(s)).toMatchObject({ phase: 'summary', scores: { A: 1, B: 0 } });
  });

  it('tells the phone how many teams play, and reads a start without a team count as two teams', () => {
    expect(snapshotOf(INITIAL_SESSION).teams).toBeUndefined();
    expect(snapshotOf(run([{ type: 'start', config: config(), now: 0 }])).teams).toBe(2);
    const solo = run([{ type: 'start', config: config({ teams: 1 }), now: 0 }]);
    expect(snapshotOf(solo).teams).toBe(1);
    expect(snapshotOf(run([{ type: 'end' }], solo))).toMatchObject({ phase: 'summary', teams: 1 });
  });
});

describe('one player on the whole wall', () => {
  const solo = () => run([{ type: 'start', config: config({ teams: 1 }), now: 0 }]);

  it('scores the one player, and ignores a hand from a second lane (team B has no tiles)', () => {
    const start = solo();
    const answer = question(start).answer;
    const wrong = question(start).options.find((o) => o !== answer)!;
    const s = run(
      [
        { type: 'answer', team: 'B', value: answer, now: 500 },
        { type: 'answer', team: 'A', value: wrong, now: 1000 },
        { type: 'answer', team: 'A', value: answer, now: 3000 },
        { type: 'tick', now: QUESTION_TIME_MS.choice },
      ],
      start,
    );
    expect(snapshotOf(s).scores).toEqual({ A: 1, B: 0 });
    expect(roundResults(s)).toEqual([{ t: 'result', round: 1, correct: true, team: 'A', ms: 3000 }]);
  });

  it('adapts the difficulty to the one child', () => {
    const start = solo();
    const levelOf = (x: SessionState) => (x.phase === 'question' || x.phase === 'feedback' ? x.level : 0);
    const s = run([{ type: 'answer', team: 'A', value: question(start).answer, now: 10 }, { type: 'next', now: 20 }], start);
    expect(levelOf(s)).toBe(levelOf(start) + 1);
  });

  it('praises how many they got right instead of naming a winner', () => {
    const one = config({ teams: 1, rounds: 5 });
    expect(summaryTitle(one, { A: 5, B: 0 })).toBe('Perfect score!');
    expect(summaryTitle(one, { A: 3, B: 0 })).toBe('Great job!');
    expect(summaryTitle(one, { A: 1, B: 0 })).toBe('Good try! Let’s play again');
    expect(summaryTitle(config({ rounds: 5 }), { A: 2, B: 3 })).toBe('Team B wins!');
    expect(summaryTitle(config({ rounds: 5 }), { A: 2, B: 2 })).toBe('Everyone wins today!');
  });
});
