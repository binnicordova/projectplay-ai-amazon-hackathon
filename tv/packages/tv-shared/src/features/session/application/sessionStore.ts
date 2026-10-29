import type { IconArt, TeamId } from '@mimikai/contracts';
import { atom } from 'jotai';
import { atomWithReducer } from 'jotai/utils';
import { INITIAL_SESSION, reduceSession, snapshotOf } from '../domain/session';

/** The one source of truth for the game on the TV. Dispatch with `store.set(sessionAtom, event)`. */
export const sessionAtom = atomWithReducer(INITIAL_SESSION, reduceSession);

export const snapshotAtom = atom((get) => snapshotOf(get(sessionAtom)));

const NO_ART: IconArt = {};

/** Pictures of the lesson being played (memory only: they go when the class ends). */
export const artAtom = atom<IconArt>((get) => {
  const session = get(sessionAtom);
  return session.phase === 'lobby' ? NO_ART : session.config.art;
});

/** Teams with a child currently in front of the camera (lights up the team labels). */
export const activeTeamsAtom = atom<readonly TeamId[]>([]);

/** Wall-clock "now", refreshed by the session ticker, for timers in the UI. */
export const clockAtom = atom<number>(0);
