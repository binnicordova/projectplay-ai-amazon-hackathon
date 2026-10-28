/**
 * Turns three averaged camera frames of the calibration patterns (see
 * @mimikai/contracts calibration.ts) into the projection's corners in camera space.
 *
 *   corners − dark → 4 marker centroids → homography (projection → camera)
 *                  → where the projection's real corners are in the camera image
 *   center  − dark → 1 centroid → must land on the projection centre, or we reject.
 *
 * Every failure comes back as a sentence the teacher can act on.
 */
import { CENTER_MARKER, CORNER_MARKERS } from '@mimikai/contracts';
import { UNIT_SQUARE, applyHomography, calibrationHomography, computeHomography, isConvexClockwise, type Quad } from './homography';
import { MIN_CONTRAST, findBlobs, orderClockwise } from './markers';
import type { Point2 } from './pose';

export interface CalibrationCapture {
  readonly width: number;
  readonly height: number;
  readonly dark: Float32Array;
  readonly corners: Float32Array;
  /** Optional check pattern; when present it must agree with the solved corners. */
  readonly center: Float32Array | null;
}

export type AutoCalibrationResult =
  | {
      readonly ok: true;
      /** Projection corners in camera space (TL, TR, BR, BL). */
      readonly corners: Quad;
      /** Distance of the check marker from where it should be, in projection units (null = not seen). */
      readonly centerError: number | null;
    }
  | { readonly ok: false; readonly reason: string };

/** The check marker must land within this distance of the projection centre (projection units). */
export const CENTER_TOLERANCE = 0.03;
/** A fifth blob this large (relative to the fourth marker) means something else moved. */
const EXTRA_BLOB_SHARE = 0.35;
/** Perspective makes far markers smaller, but not by more than this. */
const MAX_AREA_RATIO = 8;

const fail = (reason: string): AutoCalibrationResult => ({ ok: false, reason });

export function solveAutoCalibration(capture: CalibrationCapture): AutoCalibrationResult {
  const { width, height } = capture;
  const found = findBlobs(capture.corners, capture.dark, width, height);
  if (found.contrast < MIN_CONTRAST)
    return fail('The camera cannot see the projected markers. Point the phone at the projected image and check the projector is showing the TV.');

  const blobs = found.blobs;
  if (blobs.length < 4)
    return fail(`Found ${blobs.length} of 4 corner markers. Keep the projection's corners clear and the whole image inside the camera view.`);
  if (blobs.length > 4 && blobs[4]!.area > EXTRA_BLOB_SHARE * blobs[3]!.area)
    return fail('Something else changed in the picture while calibrating. Ask everyone to stand still, away from the projection, and try again.');

  const markers = blobs.slice(0, 4);
  const areas = markers.map((b) => b.area);
  if (Math.max(...areas) > MAX_AREA_RATIO * Math.min(...areas))
    return fail('One corner marker looks partly blocked. Keep the projection clear and try again.');

  const cameraMarkers = orderClockwise(markers.map((b) => b.center)) as unknown as Quad;
  if (!isConvexClockwise(cameraMarkers)) return fail('The markers do not form a rectangle. Hold the phone level and try again.');

  const toCamera = computeHomography(CORNER_MARKERS, cameraMarkers);
  if (!toCamera) return fail('Could not solve the projection geometry. Try again.');
  const projected = UNIT_SQUARE.map((p) => applyHomography(toCamera, p));
  if (projected.some((p) => p === null)) return fail('Could not solve the projection geometry. Try again.');
  const corners = projected as unknown as Quad;
  const toProjection = calibrationHomography(corners);
  if (!toProjection) return fail('The projection looks folded or upside down. Hold the phone level and try again.');

  let centerError: number | null = null;
  if (capture.center) {
    const check = findBlobs(capture.center, capture.dark, width, height).blobs[0];
    if (check) {
      const seen = applyHomography(toProjection, check.center);
      centerError = seen ? distance(seen, CENTER_MARKER) : Infinity;
      if (centerError > CENTER_TOLERANCE)
        return fail('The check marker landed off target (the phone or someone moved). Keep still and try again.');
    }
  }
  return { ok: true, corners, centerError };
}

const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
