import { describe, expect, it } from 'vitest';
import { ENDING_STARS, endingOf, endingRings, energyShow, mimiMoodAt, type Ending, type EnergyStage } from './energy';
import { keyAt } from './keys';
import { granScene, jugarScene, saltoScene, sampleScene, type Scene, type SceneStage } from './scenes';
import { TIGER_FACES, TIGER_MIDDLE, jointsOf, pose } from './tiger';

const STAGE: SceneStage = {
  ground: 700,
  unit: 2.6,
  left: 0,
  mimiLeft: 760,
  mimiTop: { x: 960, y: 240 },
  mimiHand: { x: 1140, y: 300 },
  ringRadius: 30,
};

/** Times (ms) when Rayitas's feet cross `x`, mid-air. */
function crossings(scene: Scene, x: number): number[] {
  const hits: number[] = [];
  for (let t = 0; t < scene.ms; t += 5) {
    const a = scene.frame(t).tiger;
    const b = scene.frame(t + 5).tiger;
    if ((a.x - x) * (b.x - x) <= 0 && a.y < STAGE.ground && a.x !== b.x) hits.push(t);
  }
  return hits;
}

/** Rayitas's middle goes through the hoop's middle third, and the hoop is up. */
function expectThroughHoop(scene: Scene, hoop: number) {
  const atStart = scene.frame(1_400).hoops[hoop]!;
  const passes = crossings(scene, atStart.x);
  expect(passes.length, `crosses hoop ${hoop}`).toBeGreaterThan(0);
  const t = passes[0]!;
  const { tiger, hoops } = scene.frame(t);
  const h = hoops[hoop]!;
  expect(h.on).toBe(true);
  expect(Math.abs(tiger.y - TIGER_MIDDLE * STAGE.unit - h.y)).toBeLessThan(h.ry / 3);
}

describe("Rayitas's body", () => {
  it('crouches toward its feet, splays its legs mid-jump and swings them when it runs', () => {
    const crouched = jointsOf(pose({ crouch: 1 }));
    expect(crouched.sy).toBeLessThan(1);
    expect(crouched.sx).toBeGreaterThan(1);
    const flying = jointsOf(pose({ spread: 1 }));
    expect(flying.farFront).toBeLessThan(-60);
    expect(flying.farBack).toBeGreaterThan(60);
    const running = jointsOf(pose({ run: 1, phase: Math.PI / 2 }));
    expect(running.nearFront).toBeGreaterThan(running.farFront);
    expect(running.bob).toBeLessThan(0);
  });
});

describe('level up: Rayitas jumps through the new ring', () => {
  const scene = saltoScene(STAGE, 'lilac');

  it('runs in from off the wall and leaves again', () => {
    expect(scene.frame(0).tiger.x).toBeLessThan(STAGE.left);
    expect(scene.frame(scene.ms).tiger.x).toBeLessThan(STAGE.left);
  });

  it('goes through the hoop, and lands before Mimikai', () => {
    expectThroughHoop(scene, 0);
    expect(scene.frame(2_100).tiger.x).toBeLessThan(STAGE.mimiLeft);
    expect(scene.frame(2_100).tiger.y).toBe(STAGE.ground);
  });

  it('sends the ring back into the juggle before Rayitas leaves', () => {
    expect(scene.frame(scene.ringsBackMs - 200).hoops[0]!.on).toBe(true);
    expect(scene.frame(scene.ringsBackMs + 10).hoops[0]!.on).toBe(false);
    expect(scene.ringsBackMs).toBeLessThan(scene.ms);
  });
});

describe('five in a row: Rayitas bounds through every ring', () => {
  it('goes through each hoop in order, whatever the number of rings', () => {
    for (const rings of [['sun', 'lilac'], ['sun', 'lilac', 'white', 'mint', 'coral']] as const) {
      const scene = granScene(STAGE, rings);
      rings.forEach((_, i) => expectThroughHoop(scene, i));
      const firsts = rings.map((_, i) => crossings(scene, scene.frame(1_400).hoops[i]!.x)[0]!);
      expect([...firsts].sort((a, b) => a - b)).toEqual(firsts);
      expect(scene.frame(scene.ms).tiger.x).toBeLessThan(STAGE.left);
      expect(scene.frame(scene.ringsBackMs + 10).hoops.every((h) => !h.on)).toBe(true);
    }
  });

  it('fits a narrow wall without leaving it to jump', () => {
    const narrow = granScene({ ...STAGE, mimiLeft: 560 }, ['sun', 'lilac', 'white', 'mint']);
    expect(narrow.frame(1_150).tiger.x).toBeGreaterThan(STAGE.left - 200);
  });
});

describe('the lobby: Rayitas plays with a ring', () => {
  const scene = jugarScene(STAGE);

  it('loops without a jump and never walks into Mimikai', () => {
    const start = scene.frame(0);
    const end = scene.frame(scene.ms);
    expect(end.tiger).toMatchObject({ x: start.tiger.x, crouch: start.tiger.crouch, dir: start.tiger.dir });
    expect(end.floorRing!.x).toBeCloseTo(start.floorRing!.x, 0);
    for (let t = 0; t <= scene.ms; t += 50) expect(scene.frame(t).tiger.x).toBeLessThan(STAGE.mimiLeft);
  });

  it('rolls the ring all the way to Mimikai', () => {
    const farthest = Math.max(...Array.from({ length: 81 }, (_, i) => scene.frame(i * 50).floorRing!.x));
    expect(farthest).toBeGreaterThanOrEqual(STAGE.mimiLeft);
  });
});

describe('scenes as tracks', () => {
  it('shows exactly one face at a time and closes loops exactly', () => {
    const tracks = sampleScene(jugarScene(STAGE), STAGE);
    tracks.tiger.x.t.forEach((t) => expect(TIGER_FACES.reduce((sum, face) => sum + keyAt(tracks.tiger.faces[face], t), 0)).toBe(1));
    expect(tracks.tiger.x.v.at(-1)).toBe(tracks.tiger.x.v[0]);
    expect(tracks.floorRing).not.toBeNull();
  });

  it('has a track per hoop, and shrinks the shadow while Rayitas is in the air', () => {
    const tracks = sampleScene(granScene(STAGE, ['sun', 'lilac', 'white']), STAGE);
    expect(tracks.hoops.map((h) => h.ring)).toEqual(['sun', 'lilac', 'white']);
    expect(Math.min(...tracks.tiger.shadowScale.v)).toBeLessThan(0.9);
  });
});

describe('the energy ball', () => {
  const stage = (teams: 1 | 2): EnergyStage => ({ width: 1920, height: 1080, ball: { x: 960, y: 300 }, starsY: 150, unit: 2, teams });

  it('picks the ending from the stars, a new record winning', () => {
    expect([endingOf(1, false), endingOf(2, false), endingOf(3, false), endingOf(1, true)]).toEqual(['spark', 'energy', 'super', 'record']);
    expect(endingRings('spark')).toHaveLength(2);
    expect(endingRings('energy')).toHaveLength(3);
    expect(endingRings('super')).toHaveLength(5);
  });

  it('grows longer and bigger with how the class did, within the design lengths', () => {
    const lengths = (['spark', 'energy', 'super', 'record'] as Ending[]).map((ending) => energyShow(ending, 8, stage(1)).ms);
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
    expect(lengths[0]).toBeLessThan(6_500);
    expect(lengths[3]).toBeLessThan(11_000);
  });

  it('makes one spark per right answer, at least three, and every spark reaches the ball', () => {
    const show = energyShow('energy', 7, stage(2));
    const sparks = show.sprites.filter((s) => s.kind === 'spark');
    expect(sparks).toHaveLength(7);
    expect(energyShow('spark', 0, stage(1)).sprites.filter((s) => s.kind === 'spark')).toHaveLength(3);
    sparks.forEach((s) => {
      expect(s.x.v.at(-1)).toBe(960);
      expect(s.y.v.at(-1)).toBe(300);
    });
    // Two teams: sparks come from both halves in the teams' colours.
    expect(new Set(sparks.map((s) => s.color)).size).toBe(2);
  });

  it('shows the ending stars before the line, and rolls the record only for a record', () => {
    for (const ending of ['spark', 'energy', 'super', 'record'] as Ending[]) {
      const show = energyShow(ending, 10, stage(1));
      expect(show.stars).toHaveLength(ENDING_STARS[ending]);
      show.stars.forEach((star) => expect(star.opacity.t.at(-1)!).toBeLessThanOrEqual(show.lineAt));
      expect(show.recordRoll !== null).toBe(ending === 'record');
      expect(show.lineAt).toBeLessThan(show.ms);
    }
  });

  it('has Mimikai excited while the ball charges and full of love at the end', () => {
    const show = energyShow('super', 12, stage(2));
    expect(mimiMoodAt(show, 0)).toBe('hurry');
    expect(show.mimi.map((m) => m.mood)).toContain('onFire');
    expect(mimiMoodAt(show, show.ms)).toBe('greatEffort');
  });
});
