/**
 * How each mood moves, as keyframes over one play of the mood (fractions 0..1 of its length),
 * in rig units (the logo's 256 grid) and degrees. These are the CSS keyframes of the moods page
 * as data: the TV turns them into native-driver animations, and the tests check the promises
 * the design makes (reactions peak in the first 1.2 s, everything ends at rest).
 *
 * Moods are written for the right half of the wall (team B); `choreographyOf` mirrors them
 * when the pet turns to team A.
 */
import type { PetCue } from './cue';
import { MOODS, type Mood } from './moods';

/**
 * - y: the whole body up (negative) or down. sx, sy: squash and stretch from the floor.
 * - spin: the whole body turns (a flip is 360). armL, armR: arms turn at the shoulders, added
 *   to the juggling swing (positive = clockwise on screen).
 * - nod, headY: the head turns at the neck and drops (a bow). look: the face slides sideways.
 */
export type Channel = 'y' | 'sx' | 'sy' | 'spin' | 'armL' | 'armR' | 'nod' | 'headY' | 'look';
export const CHANNELS: readonly Channel[] = ['y', 'sx', 'sy', 'spin', 'armL', 'armR', 'nod', 'headY', 'look'];
export const REST: Readonly<Record<Channel, number>> = { y: 0, sx: 1, sy: 1, spin: 0, armL: 0, armR: 0, nod: 0, headY: 0, look: 0 };

/** [fraction of the mood's length, value], fractions non-decreasing from 0 to 1. */
export type Keys = readonly (readonly [number, number])[];

/** Effects drawn around the pet. "dwell" rides on the right tentacle. */
export type FxKind = 'confetti' | 'hearts' | 'heart' | 'zzz' | 'spark' | 'twinkle' | 'badge' | 'rays' | 'dwell';

export interface Fx {
  readonly kind: FxKind;
  readonly opacity: Keys;
  readonly scale?: Keys;
  readonly y?: Keys;
  readonly spin?: Keys;
}

export interface Choreography {
  readonly tracks: Partial<Readonly<Record<Channel, Keys>>>;
  readonly fx: readonly Fx[];
}

const breathe = (amount: number): Partial<Record<Channel, Keys>> => ({
  sx: [[0, 1], [0.5, 1 + amount], [1, 1]],
  sy: [[0, 1], [0.5, 1 - amount], [1, 1]],
});

const TWINKLE: Fx = { kind: 'twinkle', opacity: [[0, 0], [0.15, 1], [0.75, 1], [1, 0]], scale: [[0, 0.3], [0.25, 1.1], [0.5, 0.8], [0.75, 1.1], [1, 0.6]] };

export const CHOREOGRAPHY: Readonly<Record<Mood, Choreography>> = {
  waiting: {
    tracks: {
      sx: [[0, 1], [0.25, 1.025], [0.5, 1], [0.75, 1.025], [1, 1]],
      sy: [[0, 1], [0.25, 0.975], [0.5, 1], [0.75, 0.975], [1, 1]],
      y: [[0, 0], [0.5, -5], [1, 0]],
      look: [[0, 0], [0.28, 0], [0.36, -6], [0.58, -6], [0.66, 5], [0.9, 5], [1, 0]],
    },
    fx: [],
  },
  nap: {
    tracks: {
      ...breathe(0.035),
      nod: [[0, 2], [0.5, 5], [1, 2]],
      headY: [[0, 2], [0.5, 4], [1, 2]],
      // Arms down: the rings are resting too.
      armL: [[0, -28], [0.5, -32], [1, -28]],
      armR: [[0, 28], [0.5, 32], [1, 28]],
    },
    fx: [{ kind: 'zzz', opacity: [[0, 0], [0.2, 1], [0.8, 1], [1, 0]], y: [[0, 0], [1, -24]], scale: [[0, 0.8], [1, 1.1]] }],
  },
  tickled: {
    tracks: {
      y: [[0, 0], [0.12, -14], [0.25, 0], [0.37, -10], [0.5, 0], [0.62, -6], [0.75, 0], [1, 0]],
      spin: [[0, 0], [0.1, -6], [0.2, 6], [0.3, -6], [0.4, 6], [0.5, -4], [0.6, 3], [0.7, 0], [1, 0]],
      sx: [[0, 1], [0.25, 1.08], [0.3, 1], [0.5, 1.06], [0.55, 1], [1, 1]],
      sy: [[0, 1], [0.25, 0.92], [0.3, 1], [0.5, 0.94], [0.55, 1], [1, 1]],
      // Curls up its arms: the rings fly round it on their own.
      armL: [[0, 0], [0.18, 30], [0.8, 30], [1, 0]],
      armR: [[0, 0], [0.18, -30], [0.8, -30], [1, 0]],
      nod: [[0, 0], [0.2, -5], [0.4, 5], [0.6, -3], [0.8, 0], [1, 0]],
    },
    fx: [{ kind: 'hearts', opacity: [[0, 0], [0.2, 1], [0.8, 1], [1, 0]], y: [[0, 0], [1, -40]], scale: [[0, 0.5], [0.25, 1.1], [1, 1]] }],
  },
  wave: {
    tracks: {
      armR: [[0, 0], [0.1, 18], [0.2, -14], [0.3, 18], [0.4, -14], [0.5, 18], [0.6, -14], [0.7, 18], [0.85, 0], [1, 0]],
      look: [[0, 0], [0.1, 6], [0.85, 6], [1, 0]],
      spin: [[0, 0], [0.1, 4], [0.85, 4], [1, 0]],
      y: [[0, 0], [0.1, -8], [0.2, 0], [1, 0]],
    },
    fx: [],
  },
  hello: {
    tracks: {
      armL: [[0, 0], [0.1, -18], [0.2, 14], [0.3, -18], [0.4, 14], [0.5, -18], [0.6, 14], [0.75, 0], [1, 0]],
      armR: [[0, 0], [0.1, 18], [0.2, -14], [0.3, 18], [0.4, -14], [0.5, 18], [0.6, -14], [0.75, 0], [1, 0]],
      y: [[0, 0], [0.12, -16], [0.24, 0], [0.36, -8], [0.48, 0], [1, 0]],
      sx: [[0, 1], [0.24, 1.08], [0.3, 1], [1, 1]],
      sy: [[0, 1], [0.24, 0.92], [0.3, 1], [1, 1]],
    },
    fx: [TWINKLE],
  },
  think: {
    tracks: { ...breathe(0.02), nod: [[0, -6], [0.5, -2], [1, -6]], spin: [[0, -2], [0.5, 1], [1, -2]] },
    fx: [],
  },
  showMe: {
    tracks: {
      // Holds a tentacle out while the dwell ring fills, exactly like a child's hand on a tile.
      armR: [[0, 0], [0.14, 42], [0.8, 42], [0.94, 0], [1, 0]],
      look: [[0, 0], [0.12, 6], [0.82, 6], [0.92, 0], [1, 0]],
      spin: [[0, 0], [0.14, 3], [0.8, 3], [0.94, 0], [1, 0]],
    },
    fx: [{ kind: 'dwell', opacity: [[0, 0], [0.18, 1], [0.79, 1], [0.86, 0], [1, 0]], scale: [[0, 0.2], [0.18, 0.2], [0.7, 1], [0.79, 1], [0.86, 1.5], [1, 1.5]] }],
  },
  hurry: {
    tracks: { y: [[0, 0], [0.5, -12], [1, 0]], sx: [[0, 1], [0.5, 0.97], [1, 1]], sy: [[0, 1], [0.5, 1.04], [1, 1]] },
    fx: [],
  },
  gotIt: {
    tracks: {
      y: [[0, 0], [0.12, 0], [0.24, -12], [0.38, -48], [0.54, -10], [0.62, 0], [1, 0]],
      sx: [[0, 1], [0.12, 1.13], [0.24, 0.9], [0.45, 1], [0.62, 1.12], [0.72, 0.97], [0.82, 1], [1, 1]],
      sy: [[0, 1], [0.12, 0.84], [0.24, 1.12], [0.45, 1], [0.62, 0.86], [0.72, 1.04], [0.82, 1], [1, 1]],
      armL: [[0, 0], [0.12, 0], [0.38, -24], [0.62, 0], [1, 0]],
      armR: [[0, 0], [0.12, 0], [0.38, 24], [0.62, 0], [1, 0]],
    },
    fx: [{ kind: 'confetti', opacity: [[0, 0], [0.15, 0], [0.2, 1], [0.6, 1], [0.85, 0], [1, 0]], scale: [[0, 0.2], [0.15, 0.2], [0.45, 1.05], [1, 1.2]] }],
  },
  onFire: {
    tracks: {
      y: [[0, 0], [0.14, 0], [0.55, -38], [0.72, 0], [1, 0]],
      // A full flip; 360° is the rest pose again, so it snaps back to 0 unseen.
      spin: [[0, 0], [0.14, 0], [0.55, 360], [0.72, 360], [0.7201, 0], [1, 0]],
      sx: [[0, 1], [0.14, 1.1], [0.2, 0.92], [0.3, 1], [0.72, 1], [0.78, 1.08], [0.86, 1], [1, 1]],
      sy: [[0, 1], [0.14, 0.88], [0.2, 1.08], [0.3, 1], [0.72, 1], [0.78, 0.9], [0.86, 1], [1, 1]],
    },
    fx: [{ kind: 'badge', opacity: [[0, 0], [0.3, 0], [0.36, 1], [0.9, 1], [1, 0]], scale: [[0, 0], [0.3, 0], [0.42, 1.25], [0.5, 1], [0.9, 1], [1, 0.8]] }, TWINKLE],
  },
  niceTry: {
    tracks: {
      nod: [[0, 0], [0.3, 4], [0.6, -2], [1, 0]],
      headY: [[0, 0], [0.3, 3], [0.6, 0], [1, 0]],
      // Offers a heart: warm, not sad.
      armR: [[0, 0], [0.25, -18], [0.75, -18], [1, 0]],
    },
    fx: [
      {
        kind: 'heart',
        opacity: [[0, 0], [0.28, 0], [0.4, 1], [0.7, 1], [0.95, 0], [1, 0]],
        scale: [[0, 0.3], [0.28, 0.3], [0.4, 1.15], [0.7, 1], [1, 0.9]],
        y: [[0, 0], [0.4, -4], [0.7, -22], [1, -44]],
      },
    ],
  },
  oneArmEach: {
    tracks: {
      // The arm over the winning half pumps; the other waves kindly to the other team.
      armR: [[0, 0], [0.12, 24], [0.25, 8], [0.37, 24], [0.5, 8], [0.62, 24], [0.85, 0], [1, 0]],
      armL: [[0, 0], [0.15, -10], [0.3, 8], [0.45, -10], [0.6, 8], [0.85, 0], [1, 0]],
      look: [[0, 0], [0.1, 6], [0.85, 6], [1, 0]],
      spin: [[0, 0], [0.1, 5], [0.85, 5], [1, 0]],
      y: [[0, 0], [0.15, -10], [0.3, 0], [0.45, -10], [0.6, 0], [1, 0]],
    },
    fx: [TWINKLE],
  },
  highFive: {
    tracks: {
      armL: [[0, 0], [0.32, 40], [0.52, 40], [1, 0]],
      armR: [[0, 0], [0.32, -40], [0.52, -40], [1, 0]],
      y: [[0, 0], [0.32, -10], [0.52, -10], [0.7, 0], [1, 0]],
    },
    fx: [
      { kind: 'spark', opacity: [[0, 0], [0.26, 0], [0.34, 1], [0.5, 1], [0.64, 0], [1, 0]], scale: [[0, 0], [0.26, 0], [0.34, 1.3], [0.5, 1], [0.64, 0], [1, 0]] },
      { kind: 'confetti', opacity: [[0, 0], [0.3, 0], [0.36, 1], [0.8, 1], [1, 0]], scale: [[0, 0.2], [0.3, 0.2], [0.6, 1.05], [1, 1.2]] },
    ],
  },
  levelUp: {
    tracks: {
      // Grows and lights up while the new ring joins the juggle; the arms keep juggling.
      sx: [[0, 1], [0.18, 1.06], [0.34, 1.1], [0.8, 1.1], [1, 1]],
      sy: [[0, 1], [0.18, 0.9], [0.34, 1.1], [0.8, 1.1], [1, 1]],
      y: [[0, 0], [0.3, -20], [0.8, -20], [1, 0]],
    },
    fx: [{ kind: 'rays', opacity: [[0, 0], [0.2, 0], [0.4, 1], [0.8, 1], [1, 0]], spin: [[0, 0], [1, 90]], scale: [[0, 0.7], [0.4, 1], [1, 1.05]] }, TWINKLE],
  },
  bigJump: {
    tracks: {
      // Throws every ring up as a hoop, then cheers Rayitas through them, watching it on the left.
      armL: [[0, 0], [0.05, -30], [0.9, -30], [1, 0]],
      armR: [[0, 0], [0.05, 30], [0.9, 30], [1, 0]],
      y: [[0, 0], [0.04, -14], [0.08, 0], [0.5, 0], [0.54, -10], [0.58, 0], [1, 0]],
      look: [[0, 0], [0.1, -6], [0.85, -6], [1, 0]],
    },
    fx: [TWINKLE],
  },
  greatEffort: {
    tracks: {
      // Bows to the whole class, then opens its arms.
      headY: [[0, 0], [0.22, 10], [0.44, 10], [0.6, 0], [1, 0]],
      sx: [[0, 1], [0.22, 1.06], [0.44, 1.06], [0.6, 1], [1, 1]],
      sy: [[0, 1], [0.22, 0.92], [0.44, 0.92], [0.6, 1], [1, 1]],
      armL: [[0, 0], [0.4, 0], [0.55, -16], [0.9, -16], [1, 0]],
      armR: [[0, 0], [0.4, 0], [0.55, 16], [0.9, 16], [1, 0]],
    },
    fx: [{ kind: 'hearts', opacity: [[0, 0], [0.2, 1], [0.8, 1], [1, 0]], y: [[0, 0], [1, -50]], scale: [[0, 0.4], [0.2, 1], [1, 0.9]] }],
  },
};

/** The value of keyframes at fraction k (clamped), straight lines between keys like CSS `linear`. */
export function valueAt(keys: Keys, k: number): number {
  const first = keys[0]!;
  if (k <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!;
    if (k <= t1) {
      const [t0, v0] = keys[i - 1]!;
      return k === t1 ? v1 : v0 + ((v1 - v0) * (k - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1]![1];
}

/** Where the mood has got to after `elapsedMs` (a looping mood wraps; a finished one holds its end). */
export function progressOf(mood: Mood, elapsedMs: number): number {
  const { ms, loop } = MOODS[mood];
  const k = Math.max(0, elapsedMs) / ms;
  return loop ? k % 1 : Math.min(1, k);
}

const negate = (keys: Keys): Keys => keys.map(([t, v]) => [t, -v] as const);
const negated = (keys: Keys | undefined): Keys | undefined => (keys ? negate(keys) : undefined);

/** The same moves facing the other half of the wall: arms swap sides, turns go the other way. */
export function mirrored(c: Choreography): Choreography {
  const { armL, armR, look, spin, ...rest } = c.tracks;
  const tracks: Partial<Record<Channel, Keys>> = { ...rest };
  const set = (channel: Channel, keys: Keys | undefined) => {
    if (keys) tracks[channel] = keys;
  };
  set('armL', negated(armR));
  set('armR', negated(armL));
  set('look', negated(look));
  set('spin', negated(spin));
  return { tracks, fx: c.fx };
}

/** The choreography for a cue, turned to the half of the wall it is about. */
export const choreographyOf = (cue: PetCue): Choreography => (cue.side === 'A' ? mirrored(CHOREOGRAPHY[cue.mood]) : CHOREOGRAPHY[cue.mood]);

/** Every channel's value at fraction k of a choreography. */
export function poseOf(c: Choreography, k: number): Readonly<Record<Channel, number>> {
  const pose = { ...REST };
  CHANNELS.forEach((channel) => {
    const keys = c.tracks[channel];
    if (keys) pose[channel] = valueAt(keys, k);
  });
  return pose;
}
