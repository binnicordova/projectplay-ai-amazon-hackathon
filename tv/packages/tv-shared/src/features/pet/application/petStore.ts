/**
 * The pet's state in the TV's one Jotai store. The cue and the rings are read models of the
 * class, the pet's memory and the clock; the clock ticks five times a second, so both are
 * narrowed with an equality check and screens only re-render when the pet really changes.
 */
import { atom } from 'jotai';
import { atomWithReducer, selectAtom } from 'jotai/utils';
import { linkStatusAtom } from '../../link/application/linkClient';
import { clockAtom, sessionAtom } from '../../session/application/sessionStore';
import { energyBeats, sameCue, type Ring } from '@mimikai/pet';
import { cueOf } from '../domain/cue';
import { INITIAL_PET_MEMORY, reducePet } from '../domain/memory';
import { ringsAt } from '../domain/rings';
import { sameSpotlight, spotlightOf } from '../domain/stage';
import { momentOf } from './classMoment';

/** Dispatch pet events with `store.set(petMemoryAtom, event)`. */
export const petMemoryAtom = atomWithReducer(INITIAL_PET_MEMORY, reducePet);

export const classMomentAtom = atom((get) => momentOf(get(linkStatusAtom), get(sessionAtom)));

const liveCueAtom = atom((get) => cueOf(get(classMomentAtom), get(petMemoryAtom), get(clockAtom)));
export const petCueAtom = selectAtom(liveCueAtom, (cue) => cue, sameCue);

/** Where the pet stands during a class (corner, answer panel or full screen) and what the wall says. */
export const spotlightAtom = selectAtom(
  atom((get) => spotlightOf(get(classMomentAtom), get(liveCueAtom))),
  (spotlight) => spotlight,
  sameSpotlight,
);

/** The class's energy ball is still playing on the summary (the scores come after it). */
export const energyBallOnAtom = selectAtom(
  atom((get) => {
    const moment = get(classMomentAtom);
    if (moment.kind !== 'summary') return false;
    const { ball } = moment;
    return get(clockAtom) < ball.at + energyBeats(ball.ending, ball.rightAnswers).ms;
  }),
  (on) => on,
);

const sameRings = (a: readonly Ring[], b: readonly Ring[]) => a.length === b.length && a.every((ring, i) => ring === b[i]);
const liveRingsAtom = atom((get) => ringsAt(get(classMomentAtom), get(clockAtom)));
export const petRingsAtom = selectAtom(liveRingsAtom, (rings) => rings, sameRings);
