/**
 * Rayitas, Mimikai's tiger cub, as numbers. A pose is a handful of values (where it stands, how
 * it leans, how far its legs spread); `jointsOf` turns a pose into the angle of every limb, the
 * same maths as the design page's `poseTiger`. The rig draws the joints; scenes (scenes.ts) say
 * which pose Rayitas holds at each moment.
 *
 * Rayitas is drawn facing right with its feet at (0, 0), in "tiger units" (about 100 tall).
 * Friends, not a circus act: no whip, no stool, no fire, and it never talks.
 */
export type TigerFace = 'open' | 'happy' | 'focus' | 'wow';
export const TIGER_FACES: readonly TigerFace[] = ['open', 'happy', 'focus', 'wow'];

export interface TigerPose {
  /** Where its feet are, in the stage's units. */
  readonly x: number;
  readonly y: number;
  /** 1 facing right, -1 facing left; in between while it turns. */
  readonly dir: number;
  /** Body tilt, degrees (negative = nose up). */
  readonly lean: number;
  /** Squash and stretch of the body. */
  readonly sx: number;
  readonly sy: number;
  /** 0..1: how much it is running (legs swing, body bobs). */
  readonly run: number;
  /** Running stride, radians. */
  readonly phase: number;
  /** 0..1: legs stretched out front and back, mid-jump. */
  readonly spread: number;
  /** 0..1: crouched to jump. */
  readonly crouch: number;
  /** Tail swing, degrees. */
  readonly tail: number;
  /** Head tilt, degrees. */
  readonly tilt: number;
  readonly face: TigerFace;
}

export const TIGER_REST: TigerPose = { x: 0, y: 0, dir: 1, lean: 0, sx: 1, sy: 1, run: 0, phase: 0, spread: 0, crouch: 0, tail: 0, tilt: 0, face: 'open' };

export const pose = (values: Partial<TigerPose>): TigerPose => ({ ...TIGER_REST, ...values });

/** Joints, in tiger units: legs turn at the hips and shoulders, the tail at its root, the head at the neck. */
export const TIGER_PIVOT = {
  hips: { x: -22, y: -30 },
  shoulders: { x: 20, y: -30 },
  tail: { x: -34, y: -40 },
  /** The body leans about its middle. */
  body: { x: 0, y: -36 },
  neck: { x: 34, y: -66 },
} as const;

/** The drawing's box in tiger units (tail tip to nose, ears to paws). */
export const TIGER_BOX = { x: -72, y: -104, width: 144, height: 112 } as const;

/** How high a mid-jump Rayitas's middle is above its feet: what must pass through a hoop's centre. */
export const TIGER_MIDDLE = 36;

export interface TigerJoints {
  /** The body's bounce while running (tiger units, up is negative). */
  readonly bob: number;
  readonly lean: number;
  readonly sx: number;
  readonly sy: number;
  /** Leg angles, degrees: far and near, front and back. */
  readonly farFront: number;
  readonly nearFront: number;
  readonly farBack: number;
  readonly nearBack: number;
  readonly tail: number;
  readonly tilt: number;
}

export function jointsOf(p: TigerPose): TigerJoints {
  const stride = 34 * p.run * Math.sin(p.phase);
  const front = -70 * p.spread - 26 * p.crouch;
  const back = 70 * p.spread + 26 * p.crouch;
  return {
    bob: -Math.abs(Math.sin(p.phase)) * 5 * p.run,
    lean: p.lean,
    // Crouching squashes toward the feet, so the paws stay on the floor.
    sx: p.sx * (1 + 0.06 * p.crouch),
    sy: p.sy * (1 - 0.16 * p.crouch),
    farFront: front - stride,
    nearFront: front + stride,
    farBack: back + stride,
    nearBack: back - stride,
    tail: p.tail + 30 * p.spread,
    tilt: p.tilt,
  };
}
