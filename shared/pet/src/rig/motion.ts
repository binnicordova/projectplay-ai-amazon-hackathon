/**
 * Turns the pet's choreography and juggling patterns into native-driver animations. Each mood
 * runs on one clock (0..1 over the mood's length) and the juggling on another (0..1 over one
 * cycle); every limb and ring is an interpolation of a clock, so nothing runs on the JS thread
 * between mood changes.
 *
 * Changing mood never jumps: a value that would jump blends in from where it was. That pose is
 * computed in JS from the domain (the clock's start time is known), because a natively driven
 * value can't be read back synchronously.
 *
 * Every animated node is created and connected over the bridge when the mood changes, which
 * costs a TV stick real time (measured: ~0.5 s per mood with ~120 nodes, in a debug build). So
 * values that don't move are plain numbers, and blends exist only where a value would jump.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { CHANNELS, REST, choreographyOf, poseOf, progressOf, type Channel, type Choreography, type Fx, type FxKind, type Keys } from '../choreography';
import type { PetCue } from '../cue';
import { cycleMs, jugglerAt, restPose, sampleJuggler, TIP, type RingPose } from '../juggle';
import { MOODS, type Mood, type RingPlan } from '../moods';
import { ALL_RINGS, type Ring } from '../rings';

export type Driven = Animated.AnimatedInterpolation<number> | Animated.Value;
/** A value that may be still (a plain number) or animated. */
export type Motion = Driven | number;

const BLEND_MS = 220;
/** Below this a jump is invisible (rig units, degrees or scale). */
const SAME = 0.01;
/** Channels measured in rig units (scaled to pixels); the rest are degrees or scale factors. */
const LENGTHS: readonly Channel[] = ['y', 'headY', 'look'];

const keysOf = (keys: Keys, scale = 1) => ({ inputRange: keys.map(([t]) => t), outputRange: keys.map(([, v]) => v * scale) });

/**
 * `target`, which begins at `start`, shifted so it begins at `from` instead; the shift fades out
 * as `blend` goes 0 → 1. Only built when the value would otherwise jump.
 */
function blended(target: Motion, start: number, from: number, blend: Animated.Value): Motion {
  if (Math.abs(from - start) < SAME) return target;
  if (typeof target === 'number') return blend.interpolate({ inputRange: [0, 1], outputRange: [from, target] });
  return Animated.add(target, blend.interpolate({ inputRange: [0, 1], outputRange: [from - start, 0] }));
}

/** The sum of two motions, as a plain number when neither moves. */
export function sum(a: Motion, b: Motion): Motion {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  if (typeof a === 'number') return a === 0 ? b : Animated.add(b as Driven, new Animated.Value(a));
  if (typeof b === 'number') return b === 0 ? a : Animated.add(a, new Animated.Value(b));
  return Animated.add(a, b);
}

/** Degrees as a rotate value. */
export const degrees = (n: Motion): Animated.AnimatedInterpolation<string> | string =>
  typeof n === 'number' ? `${n}deg` : n.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

function run(clock: Animated.Value, ms: number, loop: boolean): Animated.CompositeAnimation {
  const once = Animated.timing(clock, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true });
  return loop ? Animated.loop(once) : once;
}

export interface FxNodes {
  readonly kind: FxKind;
  readonly opacity: Driven;
  readonly scale: Motion;
  readonly y: Motion;
  readonly spin: Animated.AnimatedInterpolation<string> | string;
}

export interface MoodNodes {
  readonly channels: Readonly<Record<Channel, Motion>>;
  readonly fx: readonly FxNodes[];
}

/** The body's channels for a cue, in pixels and degrees; `unit` is pixels per rig unit. */
export function useMoodMotion(cue: PetCue, unit: number): MoodNodes {
  const playing = useRef<{ readonly choreography: Choreography; readonly mood: Mood; readonly startedAt: number } | null>(null);

  const motion = useMemo(() => {
    const choreography = choreographyOf(cue);
    const before = playing.current;
    const start = poseOf(choreography, 0);
    const from = before ? poseOf(before.choreography, progressOf(before.mood, Date.now() - before.startedAt)) : start;
    const clock = new Animated.Value(0);
    const blend = new Animated.Value(0);
    const channels = {} as Record<Channel, Motion>;
    CHANNELS.forEach((channel) => {
      const keys = choreography.tracks[channel];
      const scale = LENGTHS.includes(channel) ? unit : 1;
      const target = keys ? clock.interpolate(keysOf(keys, scale)) : REST[channel] * scale;
      channels[channel] = blended(target, start[channel] * scale, from[channel] * scale, blend);
    });
    const fx = choreography.fx.map((f: Fx) => ({
      kind: f.kind,
      opacity: clock.interpolate(keysOf(f.opacity)),
      scale: f.scale ? clock.interpolate(keysOf(f.scale)) : 1,
      y: f.y ? clock.interpolate(keysOf(f.y, unit)) : 0,
      spin: f.spin ? clock.interpolate({ ...keysOf(f.spin), outputRange: f.spin.map(([, v]) => `${v}deg`) }) : '0deg',
    }));
    return { choreography, clock, blend, nodes: { channels, fx } };
    // A cue's key changes whenever the mood should play again; its side flips the moves.
  }, [cue.key, cue.side, unit]);

  useEffect(() => {
    const { ms, loop } = MOODS[cue.mood];
    playing.current = { choreography: motion.choreography, mood: cue.mood, startedAt: Date.now() };
    const animations = [run(motion.clock, ms, loop), Animated.timing(motion.blend, { toValue: 1, duration: BLEND_MS, easing: Easing.out(Easing.quad), useNativeDriver: true })];
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [motion]);

  return motion.nodes;
}

export interface RingNodes {
  readonly ring: Ring;
  readonly x: Motion;
  readonly y: Motion;
  readonly flat: Motion;
  /** 0 = not in play (shrunk away), 1 = in play. */
  readonly presence: Animated.Value;
}

export interface JugglerNodes {
  readonly rings: readonly RingNodes[];
  readonly armL: Motion;
  readonly armR: Motion;
}

interface Juggling {
  readonly plan: RingPlan;
  readonly rings: readonly Ring[];
  readonly startedAt: number;
  /** Where each ring was left, for rings that leave play. */
  readonly lastPose: Readonly<Partial<Record<Ring, RingPose>>>;
}

/** A ring joining the juggle comes out of the right tentacle. */
const FRESH: RingPose = { x: TIP.R.x, y: TIP.R.y - 20, flat: 1 };

/** The rings in play and the arms' juggling swing; positions in pixels from the rig origin. */
export function useJuggler(plan: RingPlan, rings: readonly Ring[], unit: number): JugglerNodes {
  const presence = useRef(Object.fromEntries(ALL_RINGS.map((r) => [r, new Animated.Value(0)])) as Record<Ring, Animated.Value>).current;
  const juggling = useRef<Juggling | null>(null);
  const ringsKey = rings.join();

  const motion = useMemo(() => {
    const before = juggling.current;
    const earlier = before ? jugglerAt(before.plan, before.rings.length, (Date.now() - before.startedAt) / cycleMs(before.plan, before.rings.length)) : null;
    const poseBefore = (ring: Ring): RingPose | null => {
      if (!before || !earlier) return null;
      const slot = before.rings.indexOf(ring);
      return slot >= 0 ? earlier.rings[slot]! : (before.lastPose[ring] ?? null);
    };
    const samples = sampleJuggler(plan, rings.length);
    const clock = new Animated.Value(0);
    const blend = new Animated.Value(0);
    /** One sampled track: a plain number when it never moves (resting rings, still arms). */
    const track = (values: readonly number[], scale: number, from: number): Motion => {
      const first = values[0]! * scale;
      const still = values.every((v) => v === values[0]);
      const target = still ? first : clock.interpolate({ inputRange: [...samples.at], outputRange: values.map((v) => v * scale) });
      return blended(target, first, from * scale, blend);
    };
    const lastPose: Partial<Record<Ring, RingPose>> = {};
    const nodes = ALL_RINGS.map((ring): RingNodes => {
      const slot = rings.indexOf(ring);
      const from = poseBefore(ring) ?? (slot >= 0 ? FRESH : restPose(ALL_RINGS.indexOf(ring)));
      if (slot < 0) {
        // Out of play: it shrinks away where it was.
        lastPose[ring] = from;
        return { ring, x: from.x * unit, y: from.y * unit, flat: from.flat, presence: presence[ring] };
      }
      const s = samples.rings[slot]!;
      return { ring, x: track(s.x, unit, from.x), y: track(s.y, unit, from.y), flat: track(s.flat, 1, from.flat), presence: presence[ring] };
    });
    const arms = earlier ?? { armL: 0, armR: 0 };
    return {
      clock,
      blend,
      lastPose,
      moving: samples.at.length > 2,
      nodes: { rings: nodes, armL: track(samples.armL, 1, arms.armL), armR: track(samples.armR, 1, arms.armR) },
    };
    // The ring list is compared by value: a new array with the same rings changes nothing.
  }, [plan, ringsKey, unit]);

  useEffect(() => {
    juggling.current = { plan, rings, startedAt: Date.now(), lastPose: motion.lastPose };
    const animations = [
      // Thrown away (as Rayitas's hoops), rings in play shrink away too.
      ...ALL_RINGS.map((ring) =>
        Animated.spring(presence[ring], { toValue: rings.includes(ring) && plan.mode !== 'away' ? 1 : 0, friction: 6, tension: 90, useNativeDriver: true }),
      ),
      Animated.timing(motion.blend, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ...(motion.moving ? [run(motion.clock, cycleMs(plan, rings.length), true)] : []),
    ];
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [motion]);

  return motion.nodes;
}
