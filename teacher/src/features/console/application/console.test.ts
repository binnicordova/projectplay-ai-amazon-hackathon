import { SAMPLE_ART, SAMPLE_LESSON } from '@mimikai/contracts/src/testing/sampleLesson';
import { decodeTeacherMessage, encodeMessage } from '@mimikai/contracts';
import { describe, expect, it } from 'vitest';
import { resultLabel, startCommand, teamCountFor } from './console';

describe('console', () => {
  it('starts a lesson with only its pictures, a seed and the record to beat, and it survives the wire', () => {
    const message = startCommand({ lesson: SAMPLE_LESSON, library: { ...SAMPLE_ART, '1f999': '<svg>llama</svg>' }, rounds: 10, teams: 1, record: 300 }, () => 0.5);
    expect(message).toMatchObject({ t: 'ctl', a: 'start', config: { rounds: 3, seed: 2 ** 31, teams: 1, record: 300 } });
    if (message.t !== 'ctl' || message.a !== 'start') return;
    expect(Object.keys(message.config.art).sort()).toEqual(['1f34e', '1f986']);
    expect(decodeTeacherMessage(encodeMessage(message))).toEqual({ ok: true, message });
  });

  it('describes results for the teacher, with points', () => {
    expect(resultLabel({ t: 'result', round: 2, correct: true, team: 'A', ms: 4200, points: 175 }, 2)).toBe('P2: Equipo A · bien · +175 · 4,2 s');
    expect(resultLabel({ t: 'result', round: 3, correct: false, team: null, ms: 20000 }, 1)).toBe('P3: se acabó el tiempo · a intentarlo otra vez · 20,0 s');
  });

  it('follows the TV once a class runs', () => {
    expect(teamCountFor(null, 1)).toBe(1);
    expect(teamCountFor({ phase: 'question', round: 1, rounds: 3, mode: 'choice', prompt: 'x', scores: { A: 0, B: 0 }, teams: 2 }, 1)).toBe(2);
  });
});
