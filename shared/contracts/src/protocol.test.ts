import { describe, expect, it } from 'vitest';
import {
  decodeTeacherMessage,
  decodeTvMessage,
  encodeMessage,
  type TeacherMessage,
  type TvMessage,
} from './protocol';
import { teamForPlayer, teamForX, teamsFor } from './domain';
import { SAMPLE_ART, SAMPLE_LESSON } from './testing/sampleLesson';

const config = { lesson: SAMPLE_LESSON, art: SAMPLE_ART, rounds: 3, seed: 42 };

const teacherSamples: TeacherMessage[] = [
  { t: 'hello', role: 'teacher', app: '1.0.0' },
  { t: 'ptr', p: 1, x: 0.42, y: 0.63, c: 0.91 },
  { t: 'ptr', p: 2, h: 1, x: 0.8, y: 0.2, c: 0.5 },
  { t: 'lost', p: 2 },
  { t: 'ctl', a: 'start', config },
  { t: 'ctl', a: 'start', config: { ...config, teams: 1, record: 640 } },
  { t: 'ctl', a: 'start', config: { ...config, teams: 2 } },
  { t: 'ctl', a: 'next' },
  { t: 'ctl', a: 'end' },
  { t: 'calib', show: 'corners' },
  { t: 'calib', show: null },
  { t: 'ping', ts: 1234 },
];

const tvSamples: TvMessage[] = [
  { t: 'hello', role: 'tv', platform: 'android' },
  { t: 'state', phase: 'question', round: 2, rounds: 5, mode: 'trueFalse', prompt: 'ROSA empieza con RO', scores: { A: 150, B: 0 } },
  { t: 'state', phase: 'question', round: 1, rounds: 3, mode: 'choice', prompt: '¿Con qué sílaba empieza?', scores: { A: 0, B: 0 }, teams: 2, lessonId: 'sample', level: 2, say: 'pato' },
  { t: 'state', phase: 'lobby', round: 0, rounds: 0, mode: null, prompt: null, scores: { A: 0, B: 0 } },
  { t: 'state', phase: 'summary', round: 5, rounds: 5, mode: 'choice', prompt: null, scores: { A: 4, B: 0 }, teams: 1 },
  { t: 'result', round: 2, correct: true, team: 'B', ms: 4200 },
  { t: 'result', round: 4, correct: true, team: 'A', ms: 2100, points: 185 },
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
    // Version 1 phones generated arithmetic on the TV; their start commands are refused, not misread.
    ['version 1 message', '{"v":1,"t":"ping","ts":1}'],
    ['missing type', '{"v":2}'],
    ['unknown type', '{"v":2,"t":"teleport"}'],
    ['pointer far outside projection', '{"v":2,"t":"ptr","p":1,"x":3,"y":0.5,"c":1}'],
    ['NaN-ish coordinate', '{"v":2,"t":"ptr","p":1,"x":"0.5","y":0.5,"c":1}'],
    ['fractional player id', '{"v":2,"t":"lost","p":1.5}'],
    ['third hand', '{"v":2,"t":"ptr","p":1,"h":2,"x":0.5,"y":0.5,"c":1}'],
    ['retired gesture message', '{"v":2,"t":"gesture","p":1,"kind":"armsUp"}'],
    ['unknown calibration pattern', '{"v":2,"t":"calib","show":"rainbow"}'],
    ['calibration without a pattern field', '{"v":2,"t":"calib"}'],
    ['start without config', '{"v":2,"t":"ctl","a":"start"}'],
    ['start with a skill instead of a lesson', '{"v":2,"t":"ctl","a":"start","config":{"skill":"addition","mode":"choice","rounds":5,"seed":1}}'],
    ['start with a broken lesson', JSON.stringify({ v: 2, t: 'ctl', a: 'start', config: { ...config, lesson: { ...SAMPLE_LESSON, cards: [] } } })],
    ['start with art that is not SVG', JSON.stringify({ v: 2, t: 'ctl', a: 'start', config: { ...config, art: { '1f986': '<script>' } } })],
    ['start with art under a bad icon id', JSON.stringify({ v: 2, t: 'ctl', a: 'start', config: { ...config, art: { '../x': '<svg/>' } } })],
    ['too many rounds', JSON.stringify({ v: 2, t: 'ctl', a: 'start', config: { ...config, rounds: 500 } })],
    ['three teams', JSON.stringify({ v: 2, t: 'ctl', a: 'start', config: { ...config, teams: 3 } })],
    ['team count as text', JSON.stringify({ v: 2, t: 'ctl', a: 'start', config: { ...config, teams: '1' } })],
    ['a negative record', JSON.stringify({ v: 2, t: 'ctl', a: 'start', config: { ...config, record: -5 } })],
    ['tv role spoofing teacher hello', '{"v":2,"t":"hello","role":"tv","platform":"x"}'],
  ];

  it.each(bad)('rejects %s', (_label, text) => {
    const result = decodeTeacherMessage(text);
    expect(result.ok).toBe(false);
  });

  it('rejects a tv state with an invalid team score', () => {
    const text = '{"v":2,"t":"state","phase":"question","round":1,"rounds":3,"mode":"choice","prompt":"x","scores":{"A":-1,"B":0}}';
    expect(decodeTvMessage(text).ok).toBe(false);
  });

  it('rejects a tv state with an impossible team count', () => {
    const text = '{"v":2,"t":"state","phase":"summary","round":3,"rounds":3,"mode":"choice","prompt":null,"scores":{"A":1,"B":0},"teams":1.5}';
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

  it('reads a start without a team count as two teams', () => {
    const decoded = decodeTeacherMessage(JSON.stringify({ v: 2, t: 'ctl', a: 'start', config }));
    expect(decoded.ok && decoded.message.t === 'ctl' && decoded.message.a === 'start' && decoded.message.config.teams).toBeUndefined();
  });
});
