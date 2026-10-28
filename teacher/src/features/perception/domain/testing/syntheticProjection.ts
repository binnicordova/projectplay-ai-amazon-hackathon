/**
 * Synthetic camera frames of the calibration patterns, for unit tests: a keystoned
 * projection in a dim room with a bright static object and sensor noise.
 */
import { MARKER_SIZE, markersFor, type CalibrationPattern } from '@mimikai/contracts';
import { UNIT_SQUARE, applyHomography, computeHomography, type Quad } from '../homography';
import { LUMA_HEIGHT, LUMA_WIDTH } from '../markers';
import { jitter } from './syntheticPose';

/** Ground truth: where the projection sits in the camera image (TL, TR, BR, BL). */
export const KEYSTONED: Quad = [
  { x: 0.22, y: 0.15 },
  { x: 0.8, y: 0.2 },
  { x: 0.78, y: 0.7 },
  { x: 0.25, y: 0.66 },
];

export interface SceneOptions {
  readonly projection?: Quad;
  /** Projection pixels hidden behind something (projection space test). */
  readonly blocked?: (p: { x: number; y: number }) => boolean;
  /** Extra bright spot that appears only in this pattern (someone moving). */
  readonly intruder?: { readonly pattern: CalibrationPattern; readonly x: number; readonly y: number; readonly radius: number };
  readonly markerLevel?: number;
  readonly seed?: number;
}

/** One luma frame (as the averaged Float32Array the solver receives). */
export function renderPattern(pattern: CalibrationPattern, options: SceneOptions = {}): Float32Array {
  const { projection = KEYSTONED, blocked, intruder, markerLevel = 230, seed = 1 } = options;
  const toProjection = computeHomography(projection, UNIT_SQUARE)!;
  const markers = markersFor(pattern);
  const halfY = MARKER_SIZE / 2;
  const halfX = halfY * (9 / 16); // squares on a 16:9 screen
  const frame = new Float32Array(LUMA_WIDTH * LUMA_HEIGHT);
  for (let y = 0; y < LUMA_HEIGHT; y++) {
    for (let x = 0; x < LUMA_WIDTH; x++) {
      const camera = { x: (x + 0.5) / LUMA_WIDTH, y: (y + 0.5) / LUMA_HEIGHT };
      let value = 14; // dim room
      if (camera.x > 0.85 && camera.y < 0.3) value = 140; // a lit window, in every frame
      const p = applyHomography(toProjection, camera)!;
      const onScreen = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
      if (onScreen && !blocked?.(p)) {
        value = 22; // projector black level
        if (markers.some((m) => Math.abs(p.x - m.x) <= halfX && Math.abs(p.y - m.y) <= halfY)) value = markerLevel;
      }
      if (intruder && intruder.pattern === pattern && Math.hypot(camera.x - intruder.x, camera.y - intruder.y) < intruder.radius) value = 180;
      frame[y * LUMA_WIDTH + x] = Math.max(0, Math.min(255, value + jitter(seed * 7919 + y * LUMA_WIDTH + x, 4)));
    }
  }
  return frame;
}

export function renderCapture(options: SceneOptions = {}, withCenter = true) {
  return {
    width: LUMA_WIDTH,
    height: LUMA_HEIGHT,
    dark: renderPattern('dark', { ...options, seed: 2 }),
    corners: renderPattern('corners', { ...options, seed: 3 }),
    center: withCenter ? renderPattern('center', { ...options, seed: 4 }) : null,
  };
}
