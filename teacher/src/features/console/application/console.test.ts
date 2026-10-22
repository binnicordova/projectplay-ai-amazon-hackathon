import type { SessionSnapshot } from '@projectplay/contracts';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { resultLabel, selectedTeamsAtom, sessionConfigAtom, startCommand, teamCountFor } from './console';

const live = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  phase: 'question',
  round: 1,
  rounds: 5,
  mode: 'choice',
  prompt: '3 + ? = 7',
  scores: { A: 0, B: 0 },
  ...overrides,
});

describe('teacher console', () => {
  it('sends the chosen number of teams with the start command', () => {
    const store = createStore();
    store.set(selectedTeamsAtom, 1);
    const command = startCommand(store.get(sessionConfigAtom), () => 0.5);
    expect(command).toMatchObject({ t: 'ctl', a: 'start', config: { teams: 1, seed: 2 ** 31 } });
  });

  it("looks for the TV session's teams while one runs, and for the teacher's choice between sessions", () => {
    expect(teamCountFor(null, 1)).toBe(1);
    expect(teamCountFor(live({ phase: 'lobby' }), 1)).toBe(1);
    // A remote-control practice on the TV is one player, whatever the phone has selected.
    expect(teamCountFor(live({ teams: 1 }), 2)).toBe(1);
    expect(teamCountFor(live({ phase: 'summary', teams: 2 }), 1)).toBe(2);
    // A TV from before one-player mode sends no count: it plays two teams.
    expect(teamCountFor(live(), 1)).toBe(2);
  });

  it('names the team in a result only when two teams play', () => {
    const result = { t: 'result', round: 2, correct: true, team: 'A', ms: 4210 } as const;
    expect(resultLabel(result, 2)).toBe('Q2: Team A · correct · 4.2 s');
    expect(resultLabel(result, 1)).toBe('Q2: correct · 4.2 s');
    expect(resultLabel({ t: 'result', round: 3, correct: false, team: null, ms: 20000 }, 1)).toBe('Q3: time up · try again · 20.0 s');
  });
});
