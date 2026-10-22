/**
 * Planar homography: maps camera-space points on the wall plane to projection space.
 * Calibrated once by tapping the four corners of the projected image on the phone preview.
 */
import type { Point2 } from './pose';

/** Row-major 3×3 matrix with h[8] normalised to 1. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export type Quad = readonly [Point2, Point2, Point2, Point2];

/** Projection corners in order: top-left, top-right, bottom-right, bottom-left. */
export const UNIT_SQUARE: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Solves the 8×8 DLT system with partial pivoting. Returns null for degenerate quads. */
export function computeHomography(source: Quad, target: Quad): Mat3 | null {
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = source[i]!;
    const { x: u, y: v } = target[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    if (Math.abs(a[pivot]![col]!) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const pivotRow = a[col]!;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const r = a[row]!;
      const factor = r[col]! / pivotRow[col]!;
      for (let k = col; k <= n; k++) r[k] = r[k]! - factor * pivotRow[k]!;
    }
  }
  const h = a.map((row, i) => row[n]! / row[i]!);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

export function applyHomography(h: Mat3, p: Point2): Point2 | null {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (Math.abs(w) < 1e-12) return null;
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Calibration from four tapped camera points (TL, TR, BR, BL) to the projection's unit square. */
export function calibrationHomography(cameraCorners: Quad): Mat3 | null {
  if (!isConvexClockwise(cameraCorners)) return null;
  return computeHomography(cameraCorners, UNIT_SQUARE);
}

/**
 * Where projection-space points appear in the camera picture, for drawing on the preview.
 * Returns null if the corners are degenerate or a point maps to infinity.
 */
export function projectionToCamera(cameraCorners: Quad, points: readonly Point2[]): readonly Point2[] | null {
  const h = computeHomography(UNIT_SQUARE, cameraCorners);
  if (!h) return null;
  const mapped: Point2[] = [];
  for (const p of points) {
    const q = applyHomography(h, p);
    if (!q) return null;
    mapped.push(q);
  }
  return mapped;
}

/**
 * Guards against taps in the wrong order or a collapsed quad.
 * Image y grows downwards, so TL → TR → BR → BL is clockwise on screen (positive cross products).
 */
export function isConvexClockwise(q: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    const c = q[(i + 2) % 4]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross <= 1e-6) return false;
  }
  return true;
}
