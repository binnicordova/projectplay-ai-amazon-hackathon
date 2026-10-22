/**
 * Automatic calibration pattern, shared by both apps so they agree on the geometry.
 *
 * The phone asks the TV to show a sequence of full-screen patterns and films them:
 *   'corners'  four white squares near the corners (on black)
 *   'dark'     plain black (reference for subtracting the room)
 *   'center'   one white square in the middle (independent check of the result)
 * Subtracting 'dark' from the others leaves only what the projector changed, so chairs,
 * posters and children standing still do not matter. Four marker centres give the
 * camera → projection homography; the centre marker proves it is right.
 */
import type { NormalizedPoint } from './domain';

export type CalibrationPattern = 'corners' | 'dark' | 'center';
export const CALIBRATION_PATTERNS: readonly CalibrationPattern[] = ['corners', 'dark', 'center'];

/** Marker centres in projection space, clockwise from the top-left (TL, TR, BR, BL). */
export const CORNER_MARKERS: readonly [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint] = [
  { x: 0.1, y: 0.12 },
  { x: 0.9, y: 0.12 },
  { x: 0.9, y: 0.88 },
  { x: 0.1, y: 0.88 },
];
export const CENTER_MARKER: NormalizedPoint = { x: 0.5, y: 0.5 };

/** Markers are squares on screen; side length as a fraction of the screen height. */
export const MARKER_SIZE = 0.14;

/** Marker centres a pattern shows. */
export function markersFor(pattern: CalibrationPattern): readonly NormalizedPoint[] {
  switch (pattern) {
    case 'corners':
      return CORNER_MARKERS;
    case 'center':
      return [CENTER_MARKER];
    case 'dark':
      return [];
  }
}
