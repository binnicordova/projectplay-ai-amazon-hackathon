import { describe, expect, it } from 'vitest';
import { CHANNELS, CHOREOGRAPHY, REST, choreographyOf, mirrored, progressOf, valueAt, type Keys } from './choreography';
import { RIG_BOX, cycleMs, jugglerAt, sampleJuggler } from './juggle';
import { MOODS, REACTIONS, lineOf, type Mood } from './moods';
import { ALL_RINGS, firstRings, ringsFor } from './rings';

const MOOD_NAMES = Object.keys(MOODS) as Mood[];

describe('rings', () => {
  it('juggles one ring per class level, starting with one', () => {
    expect(ringsFor(1, [])).toEqual(['sun']);
    expect(ringsFor(2, [])).toEqual(['sun', 'lilac']);
    expect(ringsFor(3, [])).toEqual(['sun', 'lilac', 'white']);
  });

  it('adds a team ring from a streak of 3, up to five rings', () => {
    expect(ringsFor(3, [{ team: 'A', streak: 2 }])).toHaveLength(3);
    expect(ringsFor(3, [{ team: 'A', streak: 3 }])).toEqual(['sun', 'lilac', 'white', 'mint']);
    expect(ringsFor(3, [{ team: 'A', streak: 4 }, { team: 'B', streak: 9 }])).toEqual(['sun', 'lilac', 'white', 'mint', 'coral']);
  });

  it('collects between one and five rings outside a class', () => {
    expect(firstRings(0)).toEqual(['sun']);
    expect(firstRings(3)).toEqual(['sun', 'lilac', 'white']);
    expect(firstRings(9)).toEqual(ALL_RINGS);
  });
});

describe('words', () => {
  it('varies a mood\'s line with a counter and has none for silent moods', () => {
    expect(lineOf('gotIt', 0)).not.toBe(lineOf('gotIt', 1));
    expect(lineOf('gotIt', 3)).toBe(lineOf('gotIt', 0));
    expect(lineOf('think', 2)).toBeNull();
  });
});

describe('choreography', () => {
  const allKeys = (mood: Mood): Keys[] => [...Object.values(CHOREOGRAPHY[mood].tracks), ...CHOREOGRAPHY[mood].fx.flatMap((f) => [f.opacity, f.scale, f.y, f.spin])].filter((k): k is Keys => !!k);

  it('writes every track from the start (0) to the end (1) of the mood', () => {
    MOOD_NAMES.forEach((mood) =>
      allKeys(mood).forEach((keys) => {
        expect(keys[0]![0]).toBe(0);
        expect(keys.at(-1)![0]).toBe(1);
        keys.slice(1).forEach(([t], i) => expect(t).toBeGreaterThanOrEqual(keys[i]![0]));
      }),
    );
  });

  it('starts and ends one-off moods at rest, and closes every loop', () => {
    MOOD_NAMES.forEach((mood) => {
      const { tracks, fx } = CHOREOGRAPHY[mood];
      CHANNELS.forEach((channel) => {
        const keys = tracks[channel];
        if (!keys) return;
        if (MOODS[mood].loop) expect(valueAt(keys, 1), `${mood}.${channel}`).toBeCloseTo(valueAt(keys, 0));
        else {
          expect(valueAt(keys, 0), `${mood}.${channel}`).toBe(REST[channel]);
          expect(valueAt(keys, 1), `${mood}.${channel}`).toBe(REST[channel]);
        }
      });
      fx.forEach((f) => {
        expect(valueAt(f.opacity, 0), `${mood}.${f.kind}`).toBe(0);
        expect(valueAt(f.opacity, 1), `${mood}.${f.kind}`).toBe(0);
      });
    });
  });

  it('peaks every answer-screen reaction within 1.2 s and ends it by 2.6 s', () => {
    REACTIONS.forEach((mood) => {
      const { ms } = MOODS[mood];
      expect(ms, mood).toBeLessThanOrEqual(2_600);
      const { tracks, fx } = CHOREOGRAPHY[mood];
      const peakMs = (keys: Keys, rest: number) => {
        const deviation = (v: number) => Math.abs(v - rest);
        const most = Math.max(...keys.map(([, v]) => deviation(v)));
        return keys.find(([, v]) => deviation(v) === most)![0] * ms;
      };
      CHANNELS.forEach((channel) => {
        const keys = tracks[channel];
        if (keys) expect(peakMs(keys, REST[channel]), `${mood}.${channel}`).toBeLessThanOrEqual(1_200);
      });
      fx.forEach((f) => expect(peakMs(f.opacity, 0), `${mood}.${f.kind}`).toBeLessThanOrEqual(1_200));
    });
  });

  it('mirrors a mood to the other half of the wall', () => {
    const wave = CHOREOGRAPHY.wave;
    const toA = mirrored(wave);
    expect(toA.tracks.armL).toEqual(wave.tracks.armR!.map(([t, v]) => [t, -v]));
    expect(toA.tracks.armR).toBeUndefined();
    expect(choreographyOf({ mood: 'wave', key: '', side: 'A', line: null, count: null })).toEqual(toA);
    expect(choreographyOf({ mood: 'wave', key: '', side: 'B', line: null, count: null })).toBe(wave);
  });

  it('loops a looping mood and holds the end of a one-off one', () => {
    expect(progressOf('waiting', MOODS.waiting.ms * 1.5)).toBeCloseTo(0.5);
    expect(progressOf('gotIt', MOODS.gotIt.ms * 3)).toBe(1);
    expect(valueAt([[0, 0], [0.5, 10], [1, 0]], 0.25)).toBe(5);
  });
});

describe('juggling', () => {
  const plans = MOOD_NAMES.map((mood) => MOODS[mood].rings);
  const RING_RADIUS = 22;

  it('closes every pattern: each ring and arm is back where it started after one cycle', () => {
    plans.forEach((plan) =>
      [1, 2, 3, 4, 5].forEach((count) => {
        const start = jugglerAt(plan, count, 0);
        const end = jugglerAt(plan, count, 0.999_999);
        start.rings.forEach((ring, i) => {
          expect(end.rings[i]!.x).toBeCloseTo(ring.x, 2);
          expect(end.rings[i]!.y).toBeCloseTo(ring.y, 2);
        });
        expect(end.armL).toBeCloseTo(start.armL, 2);
        expect(end.armR).toBeCloseTo(start.armR, 2);
      }),
    );
  });

  it('passes a single ring from one tentacle to the other', () => {
    const plan = MOODS.waiting.rings;
    const atRight = jugglerAt(plan, 1, 0).rings[0]!;
    const atLeft = jugglerAt(plan, 1, 0.5).rings[0]!;
    expect(atRight.x).toBeGreaterThan(190);
    expect(atLeft.x).toBeLessThan(66);
    expect(cycleMs(plan, 1)).toBe(2 * 800);
  });

  it('keeps every ring inside the rig, however many rings and whatever the mood', () => {
    plans.forEach((plan) =>
      [1, 2, 3, 4, 5].forEach((count) =>
        sampleJuggler(plan, count).rings.forEach((ring) => {
          ring.x.forEach((x) => expect(x - RING_RADIUS).toBeGreaterThanOrEqual(RIG_BOX.x));
          ring.x.forEach((x) => expect(x + RING_RADIUS).toBeLessThanOrEqual(RIG_BOX.x + RIG_BOX.width));
          ring.y.forEach((y) => expect(y - RING_RADIUS).toBeGreaterThanOrEqual(RIG_BOX.y));
          ring.y.forEach((y) => expect(y + RING_RADIUS).toBeLessThanOrEqual(RIG_BOX.y + RIG_BOX.height));
        }),
      ),
    );
  });

  it('puts resting rings down beside the tentacles, lying flat', () => {
    jugglerAt({ mode: 'rest' }, 5, 0).rings.forEach((ring) => {
      expect(ring.x < 0 || ring.x > 256).toBe(true);
      expect(ring.flat).toBeLessThan(1);
    });
  });

  it('samples one closed cycle for the native driver', () => {
    const samples = sampleJuggler(MOODS.hurry.rings, 3);
    expect(samples.at[0]).toBe(0);
    expect(samples.at.at(-1)).toBe(1);
    samples.rings.forEach((ring) => expect(ring.x.at(-1)).toBe(ring.x[0]));
  });
});
