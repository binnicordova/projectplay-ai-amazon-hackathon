/**
 * Rayitas's scenes, from docs/brand/motion/mimikai-moods.html, as data an app can play on one
 * native clock:
 * - `salto`: the class climbs a level. The new ring flies out of Mimikai's juggle and grows into
 *   a hoop, Rayitas runs in and jumps through it, and the ring flies back into the juggle.
 * - `gran`: a team gets five in a row (once per team per class). Every ring in the air becomes a
 *   hoop and Rayitas bounds through them all.
 * - `jugar`: the lobby. Rayitas pounces on a ring, misses, and it rolls to Mimikai and back.
 *   Calm enough to loop for minutes.
 *
 * Each scene is written as a pose for every moment and sampled into keys, so the rules the design
 * promises (it goes through the hoop, it fits the party, it leaves the wall) have tests.
 * Distances are in tiger units times `stage.unit`, so a scene fits any wall and any Mimikai size.
 */
import type { Point } from './juggle';
import { bump, clamp01, easeInOut, easeOut, keyed, lerp, seg, type Keyed } from './keys';
import type { Ring } from './rings';
import { TIGER_FACES, TIGER_MIDDLE, jointsOf, pose, type TigerFace, type TigerJoints, type TigerPose } from './tiger';

export type SceneId = 'salto' | 'gran' | 'jugar';

/** Where things are on the wall the scene plays on, in the app's own units (e.g. pixels). */
export interface SceneStage {
  /** The floor line Rayitas and Mimikai stand on. */
  readonly ground: number;
  /** Stage units per tiger unit: Rayitas's size. */
  readonly unit: number;
  /** Left edge of Rayitas's space; it runs in from beyond it. */
  readonly left: number;
  /** Where Mimikai's body starts on the left: Rayitas lands just before it. */
  readonly mimiLeft: number;
  /** Where Mimikai's rings fly from, above its head. */
  readonly mimiTop: Point;
  /** Where a ring is caught again, above Mimikai's right tentacle. */
  readonly mimiHand: Point;
  /** A juggled ring's radius: a hoop grows from it and shrinks back to it. */
  readonly ringRadius: number;
}

export interface HoopState {
  readonly on: boolean;
  readonly x: number;
  readonly y: number;
  /** A hoop is seen side on: narrow and tall. */
  readonly rx: number;
  readonly ry: number;
  readonly stroke: number;
}

export interface SceneFrame {
  readonly tiger: TigerPose;
  readonly hoops: readonly HoopState[];
  /** The ring rolling on the floor in the lobby. */
  readonly floorRing: { readonly x: number; readonly spin: number } | null;
}

export interface Scene {
  readonly id: SceneId;
  readonly ms: number;
  readonly loop: boolean;
  /** The rings that become hoops, in order. */
  readonly rings: readonly Ring[];
  /** When the hoops are back in Mimikai's juggle (a level's new ring joins then). */
  readonly ringsBackMs: number;
  /** The scene at `ms` from its start. */
  readonly frame: (ms: number) => SceneFrame;
}

// Sizes in tiger units (Rayitas is about 100 tall), from the design page.
const HOOP_RX = 20;
const HOOP_RY = 62;
const HOOP_STROKE = 9;
/** A thrown ring arcs up this high on its way to becoming a hoop. */
const FLIGHT_ARC = 78;
const FLOOR_RING_RADIUS = 22;
/** How high Rayitas's feet must rise for its middle to pass through a hoop centred at `height`. */
const apexFor = (height: number) => height - TIGER_MIDDLE;

// Moves shared by the scenes, each a pose at `t` seconds.
const run = (stage: SceneStage, t: number, x: number): TigerPose => pose({ x, y: stage.ground, run: 1, phase: t * 15, tail: 10 * Math.sin(t * 15) });
function leap(stage: SceneStage, k: number, x0: number, x1: number, height: number): TigerPose {
  return pose({
    x: lerp(x0, x1, k),
    y: stage.ground - 4 * height * stage.unit * k * (1 - k),
    lean: -26 * (1 - 2 * k),
    spread: bump(k) ** 0.6,
    sx: 1.05,
    sy: 0.96,
    face: 'happy',
  });
}
const land = (stage: SceneStage, k: number, x: number): TigerPose => pose({ x, y: stage.ground, sx: 1 + 0.12 * bump(k), sy: 1 - 0.2 * bump(k), face: 'happy' });
const wag = (stage: SceneStage, t: number, x: number, hop: number): TigerPose =>
  pose({ x, y: stage.ground - 16 * stage.unit * bump(hop), face: 'happy', tail: 18 * Math.sin(t * 10), tilt: 7 * Math.sin(t * 3) });
function turnAndRun(stage: SceneStage, t: number, t0: number, x0: number, x1: number, seconds: number): TigerPose {
  const turn = seg(t, t0, t0 + 0.2);
  return { ...run(stage, t, lerp(x0, x1, seg(t, t0 + 0.2, t0 + 0.2 + seconds))), dir: Math.cos(Math.PI * turn), run: turn };
}

const OFF: HoopState = { on: false, x: 0, y: 0, rx: 0, ry: 0, stroke: 0 };

/** A ring flying between Mimikai and a hoop's place, growing from toy size into a hoop (or back). */
function fly(stage: SceneStage, k: number, from: Point, to: Point, back = false): HoopState {
  if (k <= 0 || k >= 1) return k >= 1 && !back ? hoopAt(stage, to, 1) : OFF;
  const e = easeInOut(k);
  const size = back ? 1 - e : e;
  const u = stage.unit;
  const ringStroke = (stage.ringRadius * 10) / 17;
  return {
    on: true,
    x: lerp(from.x, to.x, e),
    y: lerp(from.y, to.y, e) - FLIGHT_ARC * u * bump(k),
    rx: lerp(stage.ringRadius, HOOP_RX * u, size),
    ry: lerp(stage.ringRadius, HOOP_RY * u, size),
    stroke: lerp(ringStroke, HOOP_STROKE * u, size),
  };
}

/** A hoop in place; `swell` > 1 for the moment Rayitas passes through. */
const hoopAt = (stage: SceneStage, at: Point, swell: number): HoopState => ({
  on: true,
  x: at.x,
  y: at.y,
  rx: HOOP_RX * stage.unit * swell,
  ry: HOOP_RY * stage.unit * swell,
  stroke: HOOP_STROKE * stage.unit,
});

/** The level-up jump's timing: the new ring is back in the juggle at `ringsBackMs`. */
export const SALTO = { ms: 4_300, ringsBackMs: 3_000 } as const;

const GRAN_LEAP_S = 0.5;
const GRAN_LEAPS_FROM_S = 1.2;

/** The big jump's timing for `rings` hoops: longer with more rings to bound through. */
export function granTiming(rings: number): { readonly ms: number; readonly ringsBackMs: number } {
  const n = Math.max(1, rings);
  const end = GRAN_LEAPS_FROM_S + GRAN_LEAP_S * n;
  return { ms: Math.round((end + 2.1) * 1000), ringsBackMs: Math.round((end + 0.3 + 0.08 * (n - 1) + 0.6) * 1000) };
}

/** The new level's ring becomes a hoop; Rayitas runs in, jumps through it, wags and runs off. */
export function saltoScene(stage: SceneStage, ring: Ring): Scene {
  const u = stage.unit;
  const g = stage.ground;
  const landX = stage.mimiLeft - 24 * u;
  const crouchX = Math.max(stage.left + 50 * u, landX - 230 * u);
  const hoop = { x: (crouchX + landX) / 2, y: g - 142 * u };
  const offX = stage.left - 90 * u;
  const height = apexFor(142);
  return {
    id: 'salto',
    ms: SALTO.ms,
    loop: false,
    rings: [ring],
    ringsBackMs: SALTO.ringsBackMs,
    frame: (ms) => {
      const t = ms / 1000;
      const hoopNow = t < 2.3 ? fly(stage, seg(t, 0.1, 0.8), stage.mimiTop, hoop) : fly(stage, seg(t, 2.3, 3.0), hoop, stage.mimiHand, true);
      const tiger =
        t < 1.0
          ? run(stage, t, lerp(offX, crouchX, easeOut(seg(t, 0.15, 1.0))))
          : t < 1.25
            ? pose({ x: crouchX, y: g, crouch: easeOut(seg(t, 1.0, 1.12)), face: 'focus', tail: 14 * Math.sin(t * 30) })
            : t < 1.85
              ? leap(stage, seg(t, 1.25, 1.85), crouchX, landX, height)
              : t < 2.05
                ? land(stage, seg(t, 1.85, 2.05), landX)
                : t < 3.1
                  ? wag(stage, t, landX, seg(t, 2.15, 2.45))
                  : turnAndRun(stage, t, 3.1, landX, offX, 1.0);
      return { tiger, hoops: [hoopNow], floorRing: null };
    },
  };
}

/** Every ring in play becomes a hoop in a row, and Rayitas bounds through them all. */
export function granScene(stage: SceneStage, rings: readonly Ring[]): Scene {
  const u = stage.unit;
  const g = stage.ground;
  const n = Math.max(1, rings.length);
  const landX = stage.mimiLeft - 24 * u;
  // Hoops 133 units apart, closer on a narrow wall (never closer than a hoop and a gap).
  const step = Math.max(60 * u, Math.min(133 * u, (landX - (stage.left + 40 * u)) / n));
  const crouchX = landX - n * step;
  const hoops = Array.from({ length: n }, (_, i) => ({ x: crouchX + step * (i + 0.5), y: g - 133 * u }));
  const offX = Math.min(stage.left, crouchX) - 90 * u;
  const height = apexFor(133);
  const LEAP = GRAN_LEAP_S;
  const leapsStart = GRAN_LEAPS_FROM_S;
  const end = leapsStart + LEAP * n;
  const back = (i: number) => end + 0.3 + 0.08 * i;
  return {
    id: 'gran',
    ...granTiming(n),
    loop: false,
    rings,
    frame: (ms) => {
      const t = ms / 1000;
      const hoopStates = hoops.map((at, i): HoopState => {
        if (t >= back(i)) return fly(stage, seg(t, back(i), back(i) + 0.6), at, stage.mimiTop, true);
        if (t < 1.0 + 0.1 * i) return fly(stage, seg(t, 0.4 + 0.1 * i, 1.0 + 0.1 * i), stage.mimiTop, at);
        // Each hoop swells for a moment as Rayitas passes through it.
        const pass = leapsStart + LEAP * i + 0.2;
        return hoopAt(stage, at, 1 + 0.18 * bump(seg(t, pass, pass + 0.14)));
      });
      let tiger: TigerPose;
      if (t < 1.0) tiger = run(stage, t, lerp(offX, crouchX, easeOut(seg(t, 0.15, 1.0))));
      else if (t < leapsStart) tiger = pose({ x: crouchX, y: g, crouch: easeOut(seg(t, 1.0, 1.1)), face: 'focus' });
      else if (t < end) {
        const i = Math.min(n - 1, Math.floor((t - leapsStart) / LEAP));
        const k = (t - leapsStart - LEAP * i) / LEAP;
        const x0 = hoops[i]!.x - step / 2;
        tiger = k < 0.86 ? leap(stage, k / 0.86, x0, x0 + step, height) : land(stage, (k - 0.86) / 0.14, x0 + step);
      } else if (t < end + 0.9) tiger = wag(stage, t, landX, seg(t, end + 0.1, end + 0.4));
      else tiger = turnAndRun(stage, t, end + 0.9, landX, offX, 1.0);
      return { tiger, hoops: hoopStates, floorRing: null };
    },
  };
}

/** The lobby: Rayitas pounces on a ring and misses; it rolls to Mimikai and back. Loops. */
export function jugarScene(stage: SceneStage): Scene {
  const u = stage.unit;
  const g = stage.ground;
  const restX = stage.mimiLeft - 170 * u;
  const pounceX = restX + 142 * u;
  const ringOut = restX + 155 * u;
  const wall = stage.mimiLeft + 6 * u;
  const radius = FLOOR_RING_RADIUS * u;
  // Wiggles that close exactly on the 4 s loop.
  const wiggle = (2 * Math.PI * 14) / 4;
  const swish = (2 * Math.PI * 9) / 4;
  return {
    id: 'jugar',
    ms: 4_000,
    loop: true,
    rings: [],
    ringsBackMs: 0,
    frame: (ms) => {
      const t = ms / 1000;
      const ringX = t < 1.3 ? ringOut : t < 2.35 ? lerp(ringOut, wall, easeOut(seg(t, 1.3, 2.35))) : lerp(wall, ringOut, easeOut(seg(t, 2.35, 3.8)));
      let tiger: TigerPose;
      if (t < 1.1) tiger = pose({ x: restX, y: g, crouch: 1, face: 'focus', lean: 3 * Math.sin(t * wiggle), tail: 22 * Math.sin(t * swish) });
      else if (t < 1.55) tiger = { ...leap(stage, seg(t, 1.1, 1.55), restX, pounceX, 51), face: 'focus' };
      else if (t < 1.75) tiger = { ...land(stage, seg(t, 1.55, 1.75), pounceX), face: 'wow' };
      else if (t < 1.9) tiger = pose({ x: pounceX, y: g, face: 'wow', tilt: 10 });
      else if (t < 2.9) tiger = turnAndRun(stage, t, 1.9, pounceX, restX, 0.8);
      else tiger = pose({ x: restX, y: g, dir: -Math.cos(Math.PI * seg(t, 2.9, 3.1)), crouch: easeOut(seg(t, 3.1, 3.3)), face: 'focus', tail: 22 * Math.sin(t * swish) });
      return { tiger, hoops: [], floorRing: { x: ringX, spin: ((ringX - ringOut) / radius) * (180 / Math.PI) } };
    },
  };
}

export const FLOOR_RING = { radius: FLOOR_RING_RADIUS, stroke: 8 } as const;

// ---------------------------------------------------------------------------
// Sampling: a scene as keys for one native clock
// ---------------------------------------------------------------------------

export interface TigerTracks {
  readonly x: Keyed;
  readonly y: Keyed;
  readonly dir: Keyed;
  readonly joints: Readonly<Record<keyof TigerJoints, Keyed>>;
  /** 1 while that face shows, 0 otherwise. */
  readonly faces: Readonly<Record<TigerFace, Keyed>>;
  /** The shadow shrinks and fades as Rayitas jumps. */
  readonly shadowScale: Keyed;
  readonly shadowOpacity: Keyed;
}

export interface HoopTracks {
  readonly ring: Ring;
  readonly on: Keyed;
  readonly x: Keyed;
  readonly y: Keyed;
  readonly rx: Keyed;
  readonly ry: Keyed;
  readonly stroke: Keyed;
}

export interface SceneTracks {
  readonly id: SceneId;
  readonly ms: number;
  readonly loop: boolean;
  readonly tiger: TigerTracks;
  readonly hoops: readonly HoopTracks[];
  readonly floorRing: { readonly x: Keyed; readonly spin: Keyed } | null;
}

/** 30 samples a second: smooth once the native driver draws straight lines between them. */
const STEP_MS = 1000 / 30;

export function sampleScene(scene: Scene, stage: SceneStage): SceneTracks {
  const steps = Math.round(scene.ms / STEP_MS);
  const times = Array.from({ length: steps + 1 }, (_, i) => (i * scene.ms) / steps);
  // A loop's last sample is its first, so it closes exactly.
  const frames = times.map((t, i) => scene.frame(scene.loop && i === steps ? 0 : t));
  const track = (value: (frame: SceneFrame) => number): Keyed => ({ t: times, v: frames.map(value) });
  const joints = frames.map((f) => jointsOf(f.tiger));
  const jointTrack = (name: keyof TigerJoints): Keyed => ({ t: times, v: joints.map((j) => j[name]) });
  const lift = (f: SceneFrame) => clamp01((stage.ground - f.tiger.y) / (155 * stage.unit));
  return {
    id: scene.id,
    ms: scene.ms,
    loop: scene.loop,
    tiger: {
      x: track((f) => f.tiger.x),
      y: track((f) => f.tiger.y),
      dir: track((f) => f.tiger.dir),
      joints: {
        bob: jointTrack('bob'),
        lean: jointTrack('lean'),
        sx: jointTrack('sx'),
        sy: jointTrack('sy'),
        farFront: jointTrack('farFront'),
        nearFront: jointTrack('nearFront'),
        farBack: jointTrack('farBack'),
        nearBack: jointTrack('nearBack'),
        tail: jointTrack('tail'),
        tilt: jointTrack('tilt'),
      },
      faces: Object.fromEntries(TIGER_FACES.map((face) => [face, track((f) => (f.tiger.face === face ? 1 : 0))])) as Record<TigerFace, Keyed>,
      shadowScale: track((f) => 1 - 0.45 * lift(f)),
      shadowOpacity: track((f) => 1 - 0.5 * lift(f)),
    },
    hoops: scene.rings.map((ring, i) => ({
      ring,
      on: track((f) => (f.hoops[i]?.on ? 1 : 0)),
      x: track((f) => f.hoops[i]?.x ?? 0),
      y: track((f) => f.hoops[i]?.y ?? 0),
      rx: track((f) => f.hoops[i]?.rx ?? 0),
      ry: track((f) => f.hoops[i]?.ry ?? 0),
      stroke: track((f) => f.hoops[i]?.stroke ?? 0),
    })),
    floorRing: frames[0]!.floorRing ? { x: track((f) => f.floorRing?.x ?? 0), spin: track((f) => f.floorRing?.spin ?? 0) } : null,
  };
}
