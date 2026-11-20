/**
 * Where each ring is during one cycle of a juggling pattern, in rig units (the logo's 256 grid,
 * y down). A caught ring rides 20 units above a tentacle tip, as in the logo; between catches it
 * follows its own throw. The TV samples one cycle and loops it on the native animation driver,
 * so juggling costs the JS thread nothing while children's hands are arriving.
 */
import type { RingPlan } from './moods';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RingPose extends Point {
  /** 1 = upright; a ring that is put down lies flat (0.32). */
  readonly flat: number;
}

export interface JugglerPose {
  readonly rings: readonly RingPose[];
  /** Juggling swing of each arm, degrees (added to the mood's own arm moves). */
  readonly armL: number;
  readonly armR: number;
}

/** Shoulders and tentacle tips of the logo. */
export const PIVOT = { L: { x: 76, y: 158 }, R: { x: 180, y: 158 } } as const;
export const TIP = { L: { x: 45, y: 89 }, R: { x: 211, y: 89 } } as const;
/** The rig's drawing box (the logo plus room for throws and resting rings). */
export const RIG_BOX = { x: -46, y: -72, width: 348, height: 340 } as const;

export function turn(p: Point, centre: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  return { x: centre.x + dx * Math.cos(a) - dy * Math.sin(a), y: centre.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Rings that are put down lie flat in two small stacks beside the tentacles. */
export const restPose = (slot: number): RingPose => ({ x: slot % 2 ? 272 : -16, y: 244 - Math.floor(slot / 2) * 9, flat: 0.32 });

/** Length of one full cycle, ms: every ring back where it started. */
export function cycleMs(plan: RingPlan, count: number): number {
  switch (plan.mode) {
    case 'juggle':
      // One ring goes there and back; n rings take one beat each.
      return plan.beatMs * (count === 1 ? 2 : Math.max(1, count));
    case 'toss':
      return plan.beatMs;
    case 'orbit':
      return plan.periodMs;
    case 'rest':
    case 'away':
      return 1_000;
  }
}

const lerp = (a: Point, b: Point, s: number, arc: number): RingPose => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s - 4 * arc * s * (1 - s), flat: 1 });

/** Every ring and both arms at phase u (0..1) of the cycle. */
export function jugglerAt(plan: RingPlan, count: number, u: number): JugglerPose {
  const phase = ((u % 1) + 1) % 1;
  const ms = cycleMs(plan, count);
  const beats = plan.mode === 'juggle' || plan.mode === 'toss' ? ms / plan.beatMs : 0;
  const swing = 2 * Math.PI * phase * beats;
  const armR = plan.mode === 'juggle' ? 10 * Math.sin(swing) : 0;
  const armL = plan.mode === 'juggle' ? -10 * Math.sin(swing + 2.2) : plan.mode === 'toss' ? -9 * Math.sin(swing - 0.8) : 0;
  const tipL = turn(TIP.L, PIVOT.L, armL);
  const tipR = turn(TIP.R, PIVOT.R, armR);
  const left = { x: tipL.x, y: tipL.y - 20 };
  const right = { x: tipR.x, y: tipR.y - 20 };

  const ringAt = (k: number): RingPose => {
    switch (plan.mode) {
      case 'juggle': {
        const height = plan.height ?? 34 + 12 * count;
        if (count === 1) {
          // Level 1: one ring passed from tentacle to tentacle in an even arc.
          const s = (phase % 0.5) * 2;
          return phase < 0.5 ? lerp(right, left, s, height) : lerp(left, right, s, height);
        }
        // A shower: high throws from the right tentacle, quick low passes back from the left.
        const uk = (phase + k / count) % 1;
        return uk < 0.72 ? lerp(right, left, uk / 0.72, height) : lerp(left, right, (uk - 0.72) / 0.28, 22);
      }
      case 'toss':
        // One ring goes straight up from the left tentacle; the others wait on the floor.
        return k > 0 ? restPose(k - 1) : { x: left.x + 4, y: left.y - 4 * plan.height * phase * (1 - phase), flat: 1 };
      case 'orbit': {
        const a = 2 * Math.PI * phase + (k * 2 * Math.PI) / count;
        return { x: 128 + 112 * Math.sin(a), y: 136 - 100 * Math.cos(a), flat: 1 };
      }
      case 'rest':
        return restPose(k);
      case 'away':
        // Up above the head, where hoops fly from; the rig shrinks them away.
        return { x: 128, y: -40, flat: 1 };
    }
  };

  return { rings: Array.from({ length: count }, (_, k) => ringAt(k)), armL, armR };
}

export interface JugglerSamples {
  /** Phases 0..1, shared by every track. */
  readonly at: readonly number[];
  readonly rings: readonly { readonly x: readonly number[]; readonly y: readonly number[]; readonly flat: readonly number[] }[];
  readonly armL: readonly number[];
  readonly armR: readonly number[];
}

/** Samples per beat: enough for smooth arcs once the native driver draws straight lines between them. */
const STEPS_PER_BEAT = 16;

/** One cycle of the pattern, sampled for a looping native animation. */
export function sampleJuggler(plan: RingPlan, count: number): JugglerSamples {
  const steps =
    plan.mode === 'rest' || plan.mode === 'away' ? 1 : plan.mode === 'orbit' ? 48 : Math.max(STEPS_PER_BEAT, Math.round((STEPS_PER_BEAT * cycleMs(plan, count)) / plan.beatMs));
  const at = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  // The last sample is phase 1, the same pose as phase 0, so the loop closes exactly.
  const poses = at.map((u) => jugglerAt(plan, count, u === 1 ? 0 : u));
  return {
    at,
    rings: Array.from({ length: count }, (_, k) => ({
      x: poses.map((p) => p.rings[k]!.x),
      y: poses.map((p) => p.rings[k]!.y),
      flat: poses.map((p) => p.rings[k]!.flat),
    })),
    armL: poses.map((p) => p.armL),
    armR: poses.map((p) => p.armR),
  };
}
