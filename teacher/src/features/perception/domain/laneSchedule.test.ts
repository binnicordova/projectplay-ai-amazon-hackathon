import { describe, expect, it } from 'vitest';
import { PROBE_EVERY, busyLanesOf, laneForTurn } from './laneSchedule';

const schedule = (mask: number, turns = 12) => Array.from({ length: turns }, (_, turn) => laneForTurn(turn, mask, 2));
const share = (lanes: number[], lane: number) => lanes.filter((l) => l === lane).length / lanes.length;

describe('lane schedule', () => {
  it('alternates when both lanes have a child, or neither has', () => {
    expect(schedule(0b11, 6)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(schedule(0b00, 6)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('gives a single child most frames and still checks the empty lane regularly', () => {
    const lanes = schedule(0b10, PROBE_EVERY * 10);
    expect(share(lanes, 1)).toBeCloseTo(1 - 1 / PROBE_EVERY);
    // The empty lane is never left alone longer than PROBE_EVERY frames.
    const probes = lanes.flatMap((l, turn) => (l === 0 ? [turn] : []));
    probes.slice(1).forEach((turn, i) => expect(turn - probes[i]!).toBe(PROBE_EVERY));
    expect(schedule(0b01, PROBE_EVERY)).toEqual([0, 0, 0, 1]);
  });

  it('builds the lane mask from per-lane flags', () => {
    expect(busyLanesOf([false, false])).toBe(0);
    expect(busyLanesOf([true, false])).toBe(0b01);
    expect(busyLanesOf([false, true])).toBe(0b10);
    expect(busyLanesOf([true, true])).toBe(0b11);
  });
});
