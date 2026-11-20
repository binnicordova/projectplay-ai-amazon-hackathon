import type { Lesson, SessionConfig } from '@mimikai/contracts';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { linkStatusAtom } from '../../link/application/linkClient';
import { clockAtom, sessionAtom } from '../../session/application/sessionStore';
import { HURRY_MS, INTRO_MS, questionTimeMs } from '../../session/domain/session';
import { INVITE } from '../domain/cue';
import { ENERGY_BALL_DELAY_MS, momentOf } from './classMoment';
import { classMomentAtom, petCueAtom, petMemoryAtom, petRingsAtom, spotlightAtom } from './petStore';

const LESSON: Lesson = {
  format: 1,
  id: 'pet-lesson',
  title: 'Prueba',
  subject: 'matematica',
  audience: { band: 'primaria', age: 7 },
  source: 'starter',
  createdAt: '2026-10-30T00:00:00.000Z',
  cards: ['a', 'b', 'c', 'd'].map((id) => ({
    kind: 'choice' as const,
    id,
    level: 1 as const,
    prompt: { text: `¿${id}?` },
    options: [
      { kind: 'text' as const, text: 'sí' },
      { kind: 'text' as const, text: 'no' },
    ],
    answer: 0,
  })),
};

const CONFIG: SessionConfig = { lesson: LESSON, art: {}, rounds: 4, seed: 3, teams: 1 };
const CONNECTED = { state: 'connected', host: '192.168.43.1' } as const;

function classAt(now: number) {
  const store = createStore();
  store.set(linkStatusAtom, CONNECTED);
  store.set(sessionAtom, { type: 'start', config: CONFIG, now });
  store.set(clockAtom, now);
  return store;
}

describe('the class as the pet sees it', () => {
  it('is offline without the phone and in the lobby with it', () => {
    const store = createStore();
    expect(store.get(classMomentAtom)).toEqual({ kind: 'offline' });
    store.set(linkStatusAtom, CONNECTED);
    expect(store.get(classMomentAtom)).toEqual({ kind: 'lobby' });
    expect(store.get(petCueAtom).line).toBe(INVITE);
  });

  it('reads the question timer, including the hurry window the countdown uses', () => {
    const store = classAt(1_000);
    const moment = store.get(classMomentAtom);
    if (moment.kind !== 'question') throw new Error(moment.kind);
    expect(moment.endsAt - moment.startedAt).toBe(questionTimeMs(CONFIG, LESSON.cards[0]!));
    expect(moment.endsAt - moment.hurryAt).toBe(HURRY_MS);
    expect(moment.chosen).toBe(false);
    expect(moment.startedAt).toBe(1_000 + INTRO_MS);
    store.set(sessionAtom, { type: 'answer', team: 'A', value: 0, now: moment.startedAt + 1_000 });
    expect(store.get(classMomentAtom)).toMatchObject({ chosen: true });
  });

  it('reports each playing team on the answer screen', () => {
    const store = classAt(1_000);
    const open = 1_000 + INTRO_MS;
    store.set(sessionAtom, { type: 'answer', team: 'A', value: 0, now: open + 1_000 });
    store.set(sessionAtom, { type: 'next', now: open + 2_000 });
    expect(store.get(classMomentAtom)).toMatchObject({ kind: 'feedback', at: open + 2_000, teams: [{ team: 'A', correct: true, streak: 1 }], celebration: null });
    store.set(clockAtom, open + 2_100);
    expect(store.get(petCueAtom).mood).toBe('gotIt');
  });

  it('picks the energy ball from the cards played: one right of two is an energy ball; a beaten record is a record', () => {
    const store = classAt(1_000);
    const open = 1_000 + INTRO_MS;
    store.set(sessionAtom, { type: 'answer', team: 'A', value: 0, now: open + 1_000 });
    store.set(sessionAtom, { type: 'next', now: open + 2_000 }); // right
    store.set(sessionAtom, { type: 'next', now: open + 3_000 });
    store.set(sessionAtom, { type: 'next', now: open + 4_000 }); // no choice
    store.set(sessionAtom, { type: 'end', now: open + 5_000 });
    expect(store.get(classMomentAtom)).toMatchObject({ kind: 'summary', ball: { at: open + 5_000 + ENERGY_BALL_DELAY_MS, ending: 'energy', rightAnswers: 1 } });
    const recordClass = createStore();
    recordClass.set(sessionAtom, { type: 'start', config: { ...CONFIG, rounds: 1, record: 10 }, now: 0 });
    recordClass.set(sessionAtom, { type: 'answer', team: 'A', value: 0, now: INTRO_MS + 100 });
    recordClass.set(sessionAtom, { type: 'next', now: INTRO_MS + 200 });
    recordClass.set(sessionAtom, { type: 'next', now: INTRO_MS + 300 });
    expect(recordClass.get(classMomentAtom)).toMatchObject({ kind: 'summary', ball: { ending: 'record' } });
  });

  it('keeps a class running when the phone drops out for a moment', () => {
    const store = classAt(1_000);
    store.set(linkStatusAtom, { state: 'searching', attempt: 1 });
    expect(store.get(classMomentAtom).kind).toBe('question');
    expect(momentOf({ state: 'offline', reason: '' }, { phase: 'lobby' })).toEqual({ kind: 'offline' });
  });
});

describe('pet atoms', () => {
  it('keep the same cue while the clock ticks, so screens stay idle', () => {
    const store = classAt(1_000);
    store.set(clockAtom, 6_000);
    const cue = store.get(petCueAtom);
    store.set(clockAtom, 6_200);
    expect(store.get(petCueAtom)).toBe(cue);
    expect(store.get(petRingsAtom)).toEqual(['sun']);
  });

  it('puts the pet full screen to greet the class, then in its corner', () => {
    const store = classAt(1_000);
    store.set(clockAtom, 1_500);
    expect(store.get(spotlightAtom)).toMatchObject({ place: 'full', detail: 'Hoy jugamos: Prueba' });
    store.set(clockAtom, 1_000 + INTRO_MS);
    expect(store.get(spotlightAtom).place).toBe('corner');
  });

  it('giggles in the lobby when a child holds a hand on Mimikai', () => {
    const store = createStore();
    store.set(linkStatusAtom, CONNECTED);
    store.set(clockAtom, 10_000);
    store.set(petMemoryAtom, { type: 'tickled', team: 'B', now: 10_000 });
    expect(store.get(petCueAtom)).toMatchObject({ mood: 'tickled', side: 'B' });
  });
});
