/**
 * The class energy ball: how a class ends, from docs/brand/motion/mimikai-moods.html. Every right
 * answer becomes a spark that flies from the children's side of the wall into a ball above
 * Mimikai; how the ball ends depends on how the class did:
 * - spark (under half right): the ball settles and pops into hearts. One star.
 * - energy (half or more): a short charge, Mimikai throws it up, fireworks. Two stars.
 * - super (85% or more): a long charge with sun rays, the ball shoots off the wall, a soft flash,
 *   stars rain down, a superhero flip. Three stars.
 * - record (beat the class record): the super ball, then the record rolls up to the new number.
 *
 * The thresholds are the session's (`starsFor`): an app passes the stars and whether there is a
 * new record, and gets back every element as keyframes for one native clock. Effort is praised
 * at every ending: even one right answer makes a ball.
 */
import type { Mood } from './moods';
import type { Point } from './juggle';
import { keyed, noise, type Keyed } from './keys';
import { ALL_RINGS, type Ring } from './rings';

export type Ending = 'spark' | 'energy' | 'super' | 'record';
export type Stars = 1 | 2 | 3;

export const endingOf = (stars: Stars, newRecord: boolean): Ending => (newRecord ? 'record' : stars === 3 ? 'super' : stars === 2 ? 'energy' : 'spark');

export const ENDING_STARS: Readonly<Record<Ending, Stars>> = { spark: 1, energy: 2, super: 3, record: 3 };

export const ENDING_LINE: Readonly<Record<Ending, string>> = {
  spark: '¡Buen intento! Juguemos otra vez',
  energy: '¡Muy bien!',
  super: '¡Perfecto!',
  record: '¡Nuevo récord de la clase!',
};

/** The rings Mimikai ends the class with: two for a spark, three for an energy ball, all five for a super ball. */
export const endingRings = (ending: Ending): readonly Ring[] => (ending === 'spark' ? ALL_RINGS.slice(0, 2) : ending === 'energy' ? ALL_RINGS.slice(0, 3) : ALL_RINGS);

/** Where the show plays, in the app's units (e.g. pixels). `unit` is the design page's pixel at this size (it was 540 tall). */
export interface EnergyStage {
  readonly width: number;
  readonly height: number;
  /** Where the ball forms, above Mimikai's head. */
  readonly ball: Point;
  /** Where the reveal stars sit. */
  readonly starsY: number;
  readonly unit: number;
  /** Two teams: sparks fly from both halves, in the teams' colours. */
  readonly teams: 1 | 2;
}

export type SpriteKind = 'spark' | 'dot' | 'heart' | 'star';

export interface Sprite {
  readonly kind: SpriteKind;
  readonly color: string;
  /** Radius, in stage units. */
  readonly size: number;
  readonly x: Keyed;
  readonly y: Keyed;
  readonly scale: Keyed;
  readonly opacity: Keyed;
  readonly rotate: Keyed;
}

export interface EnergyShow {
  readonly ending: Ending;
  /** Length of the whole show, ms. */
  readonly ms: number;
  readonly line: string;
  /** When the line (and the summary) appear. */
  readonly lineAt: number;
  readonly ball: { readonly x: Keyed; readonly y: Keyed; readonly radius: Keyed; readonly opacity: Keyed };
  /** Sun rays while the ball charges. */
  readonly rays: { readonly opacity: Keyed; readonly scale: Keyed; readonly rotate: Keyed };
  /** The super ball's beam, and the flash when it leaves the wall. */
  readonly beam: Keyed;
  readonly flash: Keyed;
  readonly sprites: readonly Sprite[];
  /** The reveal stars, left to right. */
  readonly stars: readonly Sprite[];
  /** The record rolls up from the old number to the new one in this span. */
  readonly recordRoll: { readonly at: number; readonly ms: number } | null;
  /** What Mimikai does along the show, in order. */
  readonly mimi: readonly { readonly at: number; readonly mood: Mood }[];
}

const MINT = '#2EE0C3';
const CORAL = '#FF6B9A';
const SUN = '#FFD23F';
const LILAC = '#C9BCFF';
const PINK = '#FF8FBF';
const COLORS = [MINT, SUN, CORAL, LILAC];
/** Enough sparks to feel like a class's work, few enough for a TV stick to draw. */
const MAX_SPARKS = 24;
const FLIGHT_MS = 1_000;

const flat = (value: number, from = 0): Keyed => keyed([[from, value]]);
const hiddenUntil = (at: number, then: number, off: number): Keyed => keyed([[0, 0], [at, 0], [at + 1, 1], [then, 1], [then + 1, 0], [off, 0]]);

/** A burst of particles from a point (fireworks, hearts, a star's sparkle). */
function burst(stage: EnergyStage, at: number, centre: Point, count: number, distance: number, ms: number, kind: 'dot' | 'heart', salt: number): Sprite[] {
  const u = stage.unit;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + noise(i, salt) * 0.3;
    const d = distance * u * (0.7 + noise(i, salt + 1) * 0.5);
    const out = { x: centre.x + Math.cos(angle) * d, y: centre.y + Math.sin(angle) * d };
    return {
      kind,
      color: kind === 'heart' ? (i % 2 ? CORAL : PINK) : COLORS[i % COLORS.length]!,
      size: kind === 'heart' ? 9 * u : (4 + (i % 3) * 2) * u,
      x: keyed([[at, centre.x], [at + ms * 0.6, out.x], [at + ms, centre.x + Math.cos(angle) * d * 1.1]]),
      y: keyed([[at, centre.y], [at + ms * 0.6, out.y], [at + ms, out.y + 50 * u]]),
      scale: keyed([[at, 0.3], [at + ms * 0.6, 1], [at + ms, 0.7]]),
      opacity: keyed([[0, 0], [at, 0], [at + 1, 1], [at + ms * 0.6, 1], [at + ms, 0]]),
      rotate: flat(0),
    };
  });
}

/** One spark per right answer (at least 3), flying from the children's half of the wall into the ball. */
function sparks(stage: EnergyStage, arrivals: readonly number[]): Sprite[] {
  const u = stage.unit;
  const { ball, width, height } = stage;
  return arrivals.map((end, i): Sprite => {
    const left = stage.teams === 1 ? noise(i, 7) < 0.5 : i % 2 === 0;
    const from = {
      x: stage.teams === 1 ? width * (0.06 + 0.88 * noise(i, 3)) : left ? width * (0.06 + 0.36 * noise(i, 3)) : width * (0.58 + 0.36 * noise(i, 3)),
      y: height * (0.52 + 0.4 * noise(i, 5)),
    };
    const mid = { x: (from.x + ball.x) / 2 + (from.x < ball.x ? -90 : 90) * u, y: Math.min(from.y, ball.y) - 60 * u };
    const start = end - FLIGHT_MS;
    return {
      kind: 'spark',
      color: stage.teams === 1 ? SUN : left ? MINT : CORAL,
      size: 7 * u,
      x: keyed([[start, from.x], [start + 150, from.x], [start + 600, mid.x], [end, ball.x]]),
      y: keyed([[start, from.y], [start + 150, from.y - 14 * u], [start + 600, mid.y], [end, ball.y]]),
      scale: keyed([[start, 0.2], [start + 150, 1.2], [start + 600, 1], [end, 0.4]]),
      opacity: hiddenUntil(start, end, end + 2),
      rotate: flat(0),
    };
  });
}

const ballRadius = (stage: EnergyStage, arrived: number) => Math.min(80, 16 + arrived * 3) * stage.unit;

/** When things happen in a show, without where: enough for Mimikai's moods and the screen's timing. */
export interface EnergyBeats {
  readonly sparks: number;
  /** When each spark reaches the ball. */
  readonly arrivals: readonly number[];
  readonly gatherEnd: number;
  readonly chargeEnd: number;
  /** The spark ending: the ball settles, then pops. */
  readonly settle: number;
  readonly pop: number;
  /** The energy ending: the ball reaches the top and bursts. */
  readonly thrown: number;
  /** The super ending: the ball launches and leaves the wall; stars start raining. */
  readonly launch: number;
  readonly gone: number;
  readonly rain: number;
  /** The first reveal star pops in. */
  readonly finishEnd: number;
  readonly recordRoll: { readonly at: number; readonly ms: number } | null;
  readonly lineAt: number;
  readonly ms: number;
  readonly mimi: readonly { readonly at: number; readonly mood: Mood }[];
}

export function energyBeats(ending: Ending, rightAnswers: number): EnergyBeats {
  const sparks = Math.max(3, Math.min(MAX_SPARKS, Math.round(rightAnswers)));
  const stagger = Math.max(70, 1500 / sparks);
  // Whole milliseconds: beats are compared with clock times, which are integers.
  const arrivals = Array.from({ length: sparks }, (_, i) => Math.round(400 + i * stagger + FLIGHT_MS));
  const gatherEnd = arrivals[arrivals.length - 1]!;
  const chargeEnd = gatherEnd + (ending === 'spark' ? 0 : ending === 'energy' ? 800 : 1_300);
  const settle = gatherEnd + 600;
  const pop = settle + 380;
  const thrown = chargeEnd + 260 + 520;
  const launch = chargeEnd + 240;
  const gone = launch + 420;
  const rain = gone + 200;
  const finishEnd = (ending === 'spark' ? pop : ending === 'energy' ? thrown : rain) + 450;
  const starsEnd = finishEnd + ENDING_STARS[ending] * 260;
  const recordRoll = ending === 'record' ? { at: starsEnd, ms: 1_400 } : null;
  const lineAt = recordRoll ? recordRoll.at + recordRoll.ms : starsEnd;
  const finish: Mood = ending === 'spark' || ending === 'energy' ? 'gotIt' : 'onFire';
  const finishAt = ending === 'spark' ? gatherEnd : ending === 'energy' ? chargeEnd : launch;
  return {
    sparks,
    arrivals,
    gatherEnd,
    chargeEnd,
    settle,
    pop,
    thrown,
    launch,
    gone,
    rain,
    finishEnd,
    recordRoll,
    lineAt,
    ms: lineAt + 1_800,
    mimi: [
      { at: 0, mood: 'hurry' },
      { at: finishAt, mood: finish },
      { at: lineAt + (ending === 'super' || ending === 'record' ? 1_000 : 0), mood: 'greatEffort' },
    ],
  };
}

export function energyShow(ending: Ending, rightAnswers: number, stage: EnergyStage): EnergyShow {
  const u = stage.unit;
  const { ball } = stage;
  const beats = energyBeats(ending, rightAnswers);
  const { gatherEnd, chargeEnd, finishEnd } = beats;
  // The ball grows a little with every spark that arrives.
  const growth: (readonly [number, number])[] = [[0, 0], [399, 0], [400, 12 * u], ...beats.arrivals.map((at, k) => [at, ballRadius(stage, k + 1)] as const)];
  const full = ballRadius(stage, beats.sparks);
  const sprites: Sprite[] = sparks(stage, beats.arrivals);
  const ballX = keyed([[0, ball.x]]);
  let ballY = keyed([[0, ball.y]]);
  let radius: (readonly [number, number])[] = growth;
  let beam = flat(0);
  let flash = flat(0);

  if (ending === 'spark') {
    // The ball settles into Mimikai's arms and pops into hearts.
    ballY = keyed([[gatherEnd, ball.y], [beats.settle, ball.y + 40 * u]]);
    radius = [...growth, [beats.settle, full], [beats.settle + 150, full * 1.35], [beats.pop, 0]];
    sprites.push(...burst(stage, beats.pop, { x: ball.x, y: ball.y + 40 * u }, 9, 90, 1_300, 'heart', 11));
  } else if (ending === 'energy') {
    const top = 96 * u;
    const { thrown } = beats;
    ballY = keyed([[chargeEnd + 260, ball.y], [chargeEnd + 260 + 180, ball.y - (ball.y - top) * 0.7], [thrown, top]]);
    radius = [...growth, [chargeEnd, full], [thrown - 1, full], [thrown, 0]];
    sprites.push(...burst(stage, thrown, { x: ball.x, y: top }, 22, 230, 1_500, 'dot', 13), ...burst(stage, thrown, { x: ball.x, y: top }, 10, 120, 1_200, 'dot', 17));
  } else {
    // Off the top of the wall, a soft flash, and stars rain down.
    const { launch, gone, rain } = beats;
    ballY = keyed([[launch, ball.y], [launch + 210, ball.y - (ball.y + 140 * u) * 0.25], [gone, -140 * u]]);
    radius = [...growth, [chargeEnd, full], [gone - 1, full], [gone, 0]];
    beam = keyed([[0, 0], [launch, 0], [launch + 270, 1], [launch + 900, 0]]);
    flash = keyed([[0, 0], [gone, 0], [gone + 60, 0.6], [gone + 250, 0]]);
    sprites.push(
      ...Array.from({ length: 16 }, (_, i): Sprite => {
        const start = rain + noise(i, 19) * 600;
        const ms = 1_800 + noise(i, 23) * 1_200;
        const x = stage.width * (0.03 + 0.94 * noise(i, 29));
        return {
          kind: 'star',
          color: COLORS[i % COLORS.length]!,
          size: (6 + (i % 3) * 3) * u,
          x: keyed([[start, x], [start + ms, x + (noise(i, 31) - 0.5) * 80 * u]]),
          y: keyed([[start, -30 * u], [start + ms, stage.height + 20 * u]]),
          scale: flat(1),
          opacity: hiddenUntil(start, start + ms, start + ms + 2),
          rotate: keyed([[start, 0], [start + ms, 360 + noise(i, 37) * 360]]),
        };
      }),
    );
  }

  // The stars pop in one by one, each with a little sparkle.
  const stars = ENDING_STARS[ending];
  const gap = 96 * u;
  const x0 = ball.x - ((stars - 1) * gap) / 2;
  const starSprites = Array.from({ length: stars }, (_, i): Sprite => {
    const at = finishEnd + i * 260;
    return {
      kind: 'star',
      color: SUN,
      size: 40 * u,
      x: flat(x0 + i * gap),
      y: flat(stage.starsY),
      scale: keyed([[0, 0], [at, 0], [at + 250, 1.3], [at + 420, 1]]),
      opacity: keyed([[0, 0], [at, 0], [at + 1, 1]]),
      rotate: keyed([[at, -40], [at + 250, 10], [at + 420, 0]]),
    };
  });
  starSprites.forEach((_, i) => sprites.push(...burst(stage, finishEnd + i * 260, { x: x0 + i * gap, y: stage.starsY }, 6, 60, 700, 'dot', 41 + i)));

  return {
    ending,
    ms: beats.ms,
    line: ENDING_LINE[ending],
    lineAt: beats.lineAt,
    ball: { x: ballX, y: ballY, radius: keyed(radius), opacity: keyed([[0, 0], [399, 0], [400, 1]]) },
    rays:
      chargeEnd === gatherEnd
        ? { opacity: flat(0), scale: flat(1), rotate: flat(0) }
        : {
            opacity: keyed([[0, 0], [gatherEnd, 0], [chargeEnd, 1], [chargeEnd + 1, 0]]),
            scale: keyed([[gatherEnd, full / (90 * u)], [chargeEnd, full / (70 * u)]]),
            rotate: keyed([[gatherEnd, 0], [chargeEnd, 90]]),
          },
    beam,
    flash,
    sprites,
    stars: starSprites,
    recordRoll: beats.recordRoll,
    mimi: beats.mimi,
  };
}

/** What Mimikai does `ms` into the show. */
export function mimiMoodAt(timeline: { readonly mimi: readonly { readonly at: number; readonly mood: Mood }[] }, ms: number): Mood {
  const done = timeline.mimi.filter((step) => step.at <= ms);
  return done.length > 0 ? done[done.length - 1]!.mood : 'hurry';
}
