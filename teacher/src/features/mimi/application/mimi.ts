/**
 * Mimi's use cases on the phone: load the teacher's journey, record each finished class and each
 * lesson created with Mimi, and queue the full-screen celebrations they earned.
 */
import type { Result } from '@mimikai/contracts';
import { atom, type createStore } from 'jotai';
import { NO_PROGRESS, decodeProgress, momentsOf, nextRingIn, reduceProgress, ringsOf, streakOf, type Day, type FinishedClass, type MimiEvent, type MimiMoment, type MimiProgress } from '../domain/progress';

type Store = ReturnType<typeof createStore>;

/** Port: where the journey is kept (one small file on the phone). */
export interface ProgressStore {
  readonly load: () => Promise<unknown>;
  readonly save: (progress: MimiProgress) => Promise<Result<void>>;
}

export const mimiProgressAtom = atom<MimiProgress>(NO_PROGRESS);
export const todayAtom = atom<Day>('1970-01-01');
/** Celebrations waiting to be shown full screen, oldest first. */
export const mimiMomentsAtom = atom<readonly MimiMoment[]>([]);

export const mimiRingsAtom = atom((get) => ringsOf(get(mimiProgressAtom)));
export const mimiStreakAtom = atom((get) => streakOf(get(mimiProgressAtom).days, get(todayAtom)));
export const nextRingInAtom = atom((get) => nextRingIn(get(mimiProgressAtom)));

export interface Mimi {
  readonly load: () => Promise<void>;
  readonly classFinished: (finished: Omit<FinishedClass, 'day'>) => void;
  readonly lessonCreated: () => void;
  /** The teacher closed the celebration on screen. */
  readonly dismissMoment: () => void;
}

export function makeMimi(deps: { readonly store: Store; readonly files: ProgressStore; readonly today: () => Day }): Mimi {
  const { store, files, today } = deps;
  const apply = (event: MimiEvent) => {
    store.set(todayAtom, today());
    const before = store.get(mimiProgressAtom);
    const after = reduceProgress(before, event);
    if (after === before) return;
    store.set(mimiProgressAtom, after);
    store.set(mimiMomentsAtom, (queue) => [...queue, ...momentsOf(before, after, event)]);
    void files.save(after).then((saved) => {
      if (!saved.ok) console.log(`[mimi] could not save progress: ${saved.error}`);
    });
  };
  return {
    load: async () => {
      store.set(todayAtom, today());
      store.set(mimiProgressAtom, decodeProgress(await files.load()));
    },
    classFinished: (finished) => apply({ type: 'classFinished', finished: { ...finished, day: today() } }),
    lessonCreated: () => apply({ type: 'lessonCreated', day: today() }),
    dismissMoment: () => store.set(mimiMomentsAtom, (queue) => queue.slice(1)),
  };
}
