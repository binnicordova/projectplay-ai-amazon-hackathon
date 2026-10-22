import { teamForX } from '@projectplay/contracts';
import { describe, expect, it } from 'vitest';
import { applyHomography, calibrationHomography, type Quad } from './homography';
import { laneLayout } from './lanes';
import type { Roi } from './moveNet';
import { centreLine, teamZones, type TeamZone } from './teamZones';

const close = (actual: number, expected: number, digits = 4) => expect(actual).toBeCloseTo(expected, digits);

// Seen by a phone standing left of the projection: the left half is nearer, so it looks bigger.
const perspective: Quad = [
  { x: 0.15, y: 0.1 },
  { x: 0.75, y: 0.22 },
  { x: 0.75, y: 0.58 },
  { x: 0.15, y: 0.7 },
];

describe('team zones', () => {
  const toProjection = calibrationHomography(perspective)!;
  const [a, b] = teamZones(perspective) as [TeamZone, TeamZone];

  it('splits on the line where the TV switches teams', () => {
    for (const end of centreLine(perspective)!) close(applyHomography(toProjection, end)!.x, 0.5);
  });

  it('does not split halfway between the corners: perspective makes the nearer half bigger', () => {
    const [top, bottom] = centreLine(perspective)!;
    const halfway = (perspective[0].x + perspective[1].x) / 2;
    expect(top.x).toBeGreaterThan(halfway + 0.03);
    expect(bottom.x).toBeGreaterThan(halfway + 0.03);
  });

  it('covers exactly the calibrated projection, one half per team', () => {
    expect([a.team, b.team]).toEqual(['A', 'B']);
    expect([a.quad[0], b.quad[1], b.quad[2], a.quad[3]]).toEqual(perspective);
    expect(a.quad[1]).toEqual(b.quad[0]);
    expect(a.quad[2]).toEqual(b.quad[3]);
  });

  it('puts each label inside its own half', () => {
    for (const zone of [a, b]) {
      const p = applyHomography(toProjection, zone.labelAt)!;
      expect(teamForX(p.x)).toBe(zone.team);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(0.5);
    }
  });

  it('gives nothing for a collapsed calibration', () => {
    const line: Quad = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.3, y: 0.1 },
    ];
    expect(teamZones(line)).toBeNull();
  });

  it('agrees with the lane crops about where the split is', () => {
    const [top, bottom] = centreLine(perspective)!;
    const [left, right] = laneLayout(perspective, 4 / 3).rois as [Roi, Roi];
    // Crops start on whole pixels of the resized buffer (a few hundred wide).
    close(left.x + left.width, (top.x + bottom.x) / 2, 2);
    close(right.x, (top.x + bottom.x) / 2, 2);
  });

  it('draws one zone, the whole projection, for one player, labelled in its middle', () => {
    const zones = teamZones(perspective, 1)!;
    expect(zones).toHaveLength(1);
    expect(zones[0]!.team).toBe('A');
    expect(zones[0]!.quad).toEqual(perspective);
    close(applyHomography(toProjection, zones[0]!.labelAt)!.x, 0.5);
  });
});
