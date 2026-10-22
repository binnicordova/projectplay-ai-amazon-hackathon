/**
 * The two team halves of the projection, in camera space, for drawing on the preview.
 *
 * The TV gives everything left of the projection's centre to team A (`teamForX`), so the
 * divider is the projection's own centre line mapped back through the calibration. Under
 * keystone and perspective that line is neither vertical nor halfway between the corners
 * in the camera picture: the half nearer the phone looks bigger.
 *
 * With one player there is no divider: one zone, the whole projection.
 */
import type { TeamCount, TeamId } from '@projectplay/contracts';
import { projectionToCamera, type Quad } from './homography';
import type { Point2 } from './pose';

export interface TeamZone {
  readonly team: TeamId;
  /** Corners in camera space (TL, TR, BR, BL). */
  readonly quad: Quad;
  /** Where to put the team's name: centred in its half, just below the top edge. */
  readonly labelAt: Point2;
}

/** Projection y of the team labels: high enough to stay clear of the children's heads. */
const LABEL_Y = 0.12;

/** Where `teamForX` switches teams, top end first (projection space). */
const DIVIDER: readonly Point2[] = [
  { x: 0.5, y: 0 },
  { x: 0.5, y: 1 },
];

/** The projection's centre line in camera space (top end first), or null for a degenerate calibration. */
export function centreLine(corners: Quad): readonly [Point2, Point2] | null {
  const ends = projectionToCamera(corners, DIVIDER);
  return ends ? [ends[0]!, ends[1]!] : null;
}

/**
 * Team A's and team B's halves of the calibrated projection (or, for one player, the whole of
 * it), or null for a degenerate calibration.
 */
export function teamZones(corners: Quad, teamCount: TeamCount = 2): readonly TeamZone[] | null {
  const mapped = projectionToCamera(corners, [...DIVIDER, { x: 0.25, y: LABEL_Y }, { x: 0.75, y: LABEL_Y }, { x: 0.5, y: LABEL_Y }]);
  if (!mapped) return null;
  if (teamCount === 1) return [{ team: 'A', quad: corners, labelAt: mapped[4]! }];
  const [top, bottom, labelA, labelB] = mapped as [Point2, Point2, Point2, Point2];
  const [tl, tr, br, bl] = corners;
  return [
    { team: 'A', quad: [tl, top, bottom, bl], labelAt: labelA },
    { team: 'B', quad: [top, tr, br, bottom], labelAt: labelB },
  ];
}
