/**
 * Where to look for each team's child in the camera image.
 *
 * Children stand in front of the projection: heads and hands overlap it, bodies extend
 * below it. Each lane is a crop around one half of the projection (split at the
 * projection's own centre line, not the camera's) plus room for the body, made square
 * in physical pixels so the model sees an undistorted child as large as possible.
 *
 * Both crops have the same size, and the GPU resizer is told to output the camera image at
 * exactly the scale where a crop is MODEL_INPUT_SIZE pixels wide. Cutting a lane out of that
 * buffer is then 192 row copies (see copyLane in moveNet.ts) instead of resampling every
 * pixel in JavaScript on the camera thread, which cost ~35 ms per lane on the test phone.
 *
 * These crops are what the model reads, not what the teacher sees: squaring and margins
 * make them reach far past the projection. The preview draws the team halves instead
 * (teamZones.ts), which split on the same centre line.
 *
 * One player gets a single lane over the whole projection. Two half-lanes would cut a child
 * standing in the middle of the wall in two, and neither half would pass the body check. The
 * crop is not much bigger, because the body below the projection already sets its height: for a
 * 16:9 projection the side grows from ~1.85 to ~2.2 projection heights, so the child keeps
 * ~84% of the model's pixels and gets every frame instead of taking turns with an empty lane.
 */
import type { Quad } from './homography';
import { LANE_COUNT, MODEL_INPUT_SIZE, type Roi } from './moveNet';
import { centreLine } from './teamZones';

export const LANE_MARGINS = {
  /** Outwards, beyond the projection's left/right edge (fraction of projection width). */
  side: 0.12,
  /** Above the projection top (fraction of projection height): raised hands. */
  top: 0.15,
  /**
   * Below the projection bottom (fraction of projection height): torso and hips. The body check
   * needs the hips, and MoveNet places the arms best when it sees the whole child.
   */
  bottom: 0.7,
} as const;

/**
 * Smallest crop side (fraction of the camera image height). A tiny projection would otherwise
 * ask the resizer for a huge buffer, and a child is never smaller than this anyway.
 */
export const MIN_LANE_SIDE = 0.3;

/** A lane's top-left corner in the resized buffer (whole pixels, may lie outside it). */
export interface PixelOrigin {
  readonly x: number;
  readonly y: number;
}

export interface LaneLayout {
  /** One square crop per team (A, B), in camera space. Parts outside the image are black. */
  readonly rois: readonly Roi[];
  /** Where each crop starts in the resized buffer; each is MODEL_INPUT_SIZE pixels square. */
  readonly origins: readonly PixelOrigin[];
  /** Resizer output size at which a crop is exactly MODEL_INPUT_SIZE pixels. */
  readonly sourceWidth: number;
  readonly sourceHeight: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * @param corners   projection corners in camera space (TL, TR, BR, BL), or null if not calibrated
 * @param aspect    camera image aspect ratio (width / height)
 * @param laneCount 2 = one lane per team half, 1 = one lane over the whole projection
 */
export function laneLayout(corners: Quad | null, aspect: number, laneCount: 1 | 2 = LANE_COUNT): LaneLayout {
  const divider = corners && centreLine(corners);
  if (!corners || !divider) {
    // Not calibrated: each lane is one half of the camera image (or the one lane all of it).
    return layoutFor({ middle: 0.5, left: 0, right: 1, top: 0, bottom: 1 }, aspect, laneCount);
  }
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return layoutFor(
    {
      // Crops are upright rectangles, so a slanted (keystoned) centre line splits at its mean x.
      middle: (divider[0].x + divider[1].x) / 2,
      left: clamp01(Math.min(...xs) - LANE_MARGINS.side * w),
      right: clamp01(Math.max(...xs) + LANE_MARGINS.side * w),
      top: clamp01(Math.min(...ys) - LANE_MARGINS.top * h),
      bottom: clamp01(Math.max(...ys) + LANE_MARGINS.bottom * h),
    },
    aspect,
    laneCount,
  );
}

interface LaneBounds {
  readonly middle: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * Squares both lanes to a common side (in units of image height). Width grows away from the
 * projection centre (never into the other team's lane), height grows downwards first. A crop
 * may reach past the image edge: black padding is better than squashing the child.
 * A single lane is centred on the same centre line and reaches both edges.
 */
function layoutFor({ middle, left, right, top, bottom }: LaneBounds, aspect: number, laneCount: 1 | 2): LaneLayout {
  const halfWidth = Math.max(middle - left, right - middle) * aspect;
  const side = Math.max(MIN_LANE_SIDE, laneCount === 1 ? 2 * halfWidth : halfWidth, bottom - top);
  const sourceHeight = Math.round(MODEL_INPUT_SIZE / side);
  const sourceWidth = Math.round((MODEL_INPUT_SIZE * aspect) / side);
  // Keep the crop inside the image vertically when it fits: more body, less padding.
  const y = Math.round(Math.min(top, Math.max(0, 1 - side)) * sourceHeight);
  const divider = Math.round(middle * sourceWidth);
  const origins: PixelOrigin[] =
    laneCount === 1
      ? [{ x: divider - MODEL_INPUT_SIZE / 2, y }]
      : [
          { x: divider - MODEL_INPUT_SIZE, y },
          { x: divider, y },
        ];
  const roi = (o: PixelOrigin): Roi => ({
    x: o.x / sourceWidth,
    y: o.y / sourceHeight,
    width: MODEL_INPUT_SIZE / sourceWidth,
    height: MODEL_INPUT_SIZE / sourceHeight,
  });
  return { rois: origins.map(roi), origins, sourceWidth, sourceHeight };
}
