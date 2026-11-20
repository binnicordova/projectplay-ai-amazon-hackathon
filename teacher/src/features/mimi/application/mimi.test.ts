import { ok } from '@mimikai/contracts';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import type { MimiProgress } from '../domain/progress';
import { makeMimi, mimiMomentsAtom, mimiProgressAtom, mimiRingsAtom, mimiStreakAtom, type ProgressStore } from './mimi';

function setup(saved: unknown = null) {
  const store = createStore();
  const writes: MimiProgress[] = [];
  const files: ProgressStore = { load: async () => saved, save: async (p) => (writes.push(p), ok(undefined)) };
  const mimi = makeMimi({ store, files, today: () => '2026-11-02' });
  return { store, mimi, writes };
}

describe('Mimi on the phone', () => {
  it('loads the saved journey', async () => {
    const { store, mimi } = setup({ classes: 8, days: ['2026-10-30'] });
    await mimi.load();
    expect(store.get(mimiRingsAtom)).toBe(3);
    expect(store.get(mimiStreakAtom)).toBe(1);
  });

  it('records a finished class, saves it and queues its celebrations', async () => {
    const { store, mimi, writes } = setup();
    await mimi.load();
    mimi.classFinished({ rounds: 6, teams: 1, correct: 6, level: 2 });
    expect(store.get(mimiProgressAtom)).toMatchObject({ classes: 1, days: ['2026-11-02'] });
    expect(writes).toHaveLength(1);
    expect(store.get(mimiMomentsAtom).map((m) => m.kind)).toEqual(['classDone', 'achievement', 'achievement']);
    mimi.dismissMoment();
    expect(store.get(mimiMomentsAtom)).toHaveLength(2);
  });

  it('records a lesson created with Mimi', async () => {
    const { store, mimi } = setup();
    await mimi.load();
    mimi.lessonCreated();
    expect(store.get(mimiProgressAtom).lessonsCreated).toBe(1);
    expect(store.get(mimiMomentsAtom)).toEqual([{ kind: 'achievement', id: 'firstLesson' }]);
  });
});
