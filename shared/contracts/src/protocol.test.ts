import { describe, expect, it } from 'vitest';
import {
  decodeTeacherMessage,
  decodeTvMessage,
  encodeMessage,
  type TeacherMessage,
  type TvMessage,
} from './protocol';
import { teamForPlayer, teamForX, teamsFor } from './domain';

const teacherSamples: TeacherMessage[] = [
  { t: 'hello', role: 'teacher', app: '1.0.0' },
  { t: 'ptr', p: 1, x: 0.42, y: 0.63, c: 0.91 },
  { t: 'ptr', p: 2, h: 1, x: 0.8, y: 0.2, c: 0.5 },
  { t: 'lost', p: 2 },
  { t: 'ctl', a: 'start', config: { skill: 'missingAddend', mode: 'choice', rounds: 5, seed: 42 } },
  { t: 'ctl', a: 'start', config: { skill: 'addition', mode: 'trueFalse', rounds: 3, seed: 7, teams: 1 } },
  { t: 'ctl', a: 'start', config: { skill: 'subtraction', mode: 'choice', rounds: 8, seed: 9, teams: 2 } },
  { t: 'ctl', a: 'next' },
  { t: 'ctl', a: 'end' },
  { t: 'calib', show: 'corners' },
  { t: 'calib', show: null },
  { t: 'ping', ts: 1234 },
];

const tvSamples: TvMessage[] = [
  { t: 'hello', role: 'tv', platform: 'android' },
  { t: 'state', phase: 'question', round: 2, rounds: 5, mode: 'trueFalse', prompt: '7 + 8 = 15', scores: { A: 1, B: 0 } },
  { t: 'state', phase: 'lobby', round: 0, rounds: 0, mode: null, prompt: null, scores: { A: 0, B: 0 } },
  { t: 'state', phase: 'summary', round: 5, rounds: 5, mode: 'choice', prompt: null, scores: { A: 4, B: 0 }, teams: 1 },
  { t: 'result', round: 2, correct: true, team: 'B', ms: 4200 },
  { t: 'result', round: 3, correct: false, team: null, ms: 15000 },
  { t: 'calib', shown: 'dark' },
  { t: 'pong', ts: 99 },
];

describe('protocol round-trip', () => {
  it.each(teacherSamples)('teacher message $t survives encode/decode', (message) => {
    expect(decodeTeacherMessage(encodeMessage(message))).toEqual({ ok: true, message });
  });

  it.each(tvSamples)('tv message $t survives encode/decode', (message) => {
    expect(decodeTvMessage(encodeMessage(message))).toEqual({ ok: true, message });
  });

  it('quantises pointer coordinates to keep frames small', () => {
    const wire = encodeMessage({ t: 'ptr', p: 1, x: 0.123456, y: 0.987654, c: 0.5 });
    expect(JSON.parse(wire)).toMatchObject({ x: 0.123, y: 0.988 });
    expect(wire.length).toBeLessThan(60);
  });
});

describe('protocol rejects bad input without throwing', () => {
  const bad: Array<[string, string]> = [
    ['not json', '{oops'],
    ['array', '[1,2]'],
    ['wrong version', '{"v":2,"t":"ping","ts":1}'],
    ['missing type', '{"v":1}'],
    ['unknown type', '{"v":1,"t":"teleport"}'],
    ['pointer far outside projection', '{"v":1,"t":"ptr","p":1,"x":3,"y":0.5,"c":1}'],
    ['NaN-ish coordinate', '{"v":1,"t":"ptr","p":1,"x":"0.5","y":0.5,"c":1}'],
    ['fractional player id', '{"v":1,"t":"lost","p":1.5}'],
    ['third hand', '{"v":1,"t":"ptr","p":1,"h":2,"x":0.5,"y":0.5,"c":1}'],
    // Whole-body answers were removed: an older phone's gestures and jump counts are dropped, not misread.
    ['retired gesture message', '{"v":1,"t":"gesture","p":1,"kind":"armsUp"}'],
    ['retired jump count message', '{"v":1,"t":"count","p":1,"kind":"jump","n":3}'],
    ['retired jump mode', '{"v":1,"t":"ctl","a":"start","config":{"skill":"addition","mode":"jumpCount","rounds":5,"seed":1}}'],
    ['unknown calibration pattern', '{"v":1,"t":"calib","show":"rainbow"}'],
    ['calibration without a pattern field', '{"v":1,"t":"calib"}'],
    ['start without config', '{"v":1,"t":"ctl","a":"start"}'],
    ['too many rounds', '{"v":1,"t":"ctl","a":"start","config":{"skill":"addition","mode":"choice","rounds":500,"seed":1}}'],
    ['three teams', '{"v":1,"t":"ctl","a":"start","config":{"skill":"addition","mode":"choice","rounds":5,"seed":1,"teams":3}}'],
    ['no teams', '{"v":1,"t":"ctl","a":"start","config":{"skill":"addition","mode":"choice","rounds":5,"seed":1,"teams":0}}'],
    ['team count as text', '{"v":1,"t":"ctl","a":"start","config":{"skill":"addition","mode":"choice","rounds":5,"seed":1,"teams":"1"}}'],
    ['tv role spoofing teacher hello', '{"v":1,"t":"hello","role":"tv","platform":"x"}'],
  ];

  it.each(bad)('rejects %s', (_label, text) => {
    const result = decodeTeacherMessage(text);
    expect(result.ok).toBe(false);
  });

  it('rejects a tv state with an invalid team score', () => {
    const text = '{"v":1,"t":"state","phase":"question","round":1,"rounds":3,"mode":"choice","prompt":"x","scores":{"A":-1,"B":0}}';
    expect(decodeTvMessage(text).ok).toBe(false);
  });

  it('rejects a tv state with an impossible team count', () => {
    const text = '{"v":1,"t":"state","phase":"summary","round":3,"rounds":3,"mode":"choice","prompt":null,"scores":{"A":1,"B":0},"teams":1.5}';
    expect(decodeTvMessage(text).ok).toBe(false);
  });

  it('does not accept teacher-only messages on the tv channel', () => {
    expect(decodeTvMessage(encodeMessage({ t: 'ptr', p: 1, x: 0.5, y: 0.5, c: 1 })).ok).toBe(false);
  });
});

describe('teams', () => {
  it('splits the projection in two halves', () => {
    expect(teamForX(0.1)).toBe('A');
    expect(teamForX(0.49)).toBe('A');
    expect(teamForX(0.5)).toBe('B');
    expect(teamForX(0.9)).toBe('B');
  });

  it('maps camera lanes to teams', () => {
    expect(teamForPlayer(1)).toBe('A');
    expect(teamForPlayer(2)).toBe('B');
  });

  it('puts every player on the one team when one child plays on the whole wall', () => {
    expect(teamsFor(1)).toEqual(['A']);
    expect(teamsFor(2)).toEqual(['A', 'B']);
    expect([1, 2, 3].map((p) => teamForPlayer(p, 1))).toEqual(['A', 'A', 'A']);
    expect(teamForPlayer(2, 2)).toBe('B');
  });

  it('reads a start from a phone that predates one-player mode as two teams (no team count)', () => {
    const old = '{"v":1,"t":"ctl","a":"start","config":{"skill":"addition","mode":"choice","rounds":5,"seed":1}}';
    const decoded = decodeTeacherMessage(old);
    expect(decoded.ok && decoded.message.t === 'ctl' && decoded.message.a === 'start' && decoded.message.config).toEqual({
      skill: 'addition',
      mode: 'choice',
      rounds: 5,
      seed: 1,
    });
  });
});
