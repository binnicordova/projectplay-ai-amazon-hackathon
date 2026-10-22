/**
 * MoveNet SinglePose Lightning (INT8 TFLite), run once per *lane*.
 *
 * Why lanes: the official MultiPose TFLite model has a dynamic input shape, and
 * react-native-fast-tflite cannot resize input tensors. SinglePose has a fixed
 * [1, 192, 192, 3] uint8 input, is ~3 MB and is more accurate per person.
 *
 * Why regions of interest (ROI): children are small in a wide classroom shot. Instead of
 * feeding the whole camera image, each lane is a square crop around one half of the
 * calibrated projection (see lanes.ts), so a child fills most of the model input.
 *
 * Pipeline per frame (camera thread):
 *   Frame → GPU resizer ("stretch", RGB uint8, at the lanes' scale) → copy each lane's
 *   192×192 crop → model → decode back to camera coordinates.
 *
 * "stretch" maps normalised camera coordinates linearly onto the buffer, so ROI maths stays
 * in the same 0..1 camera space as calibration. Every function is a worklet so it runs
 * inside `useFrameOutput`'s `onFrame`, and is a plain function in unit tests.
 */
import { KEYPOINT_COUNT, POSE_LENGTH } from './pose';

export const MODEL_INPUT_SIZE = 192;
export const LANE_COUNT = 2;
export const CHANNELS = 3;
/** Resizer output while calibrating (the marker detector's input). 4:3, like the camera frames. */
export const SOURCE_WIDTH = 960;
export const SOURCE_HEIGHT = 720;
export const SOURCE_BYTES = SOURCE_WIDTH * SOURCE_HEIGHT * CHANNELS;
export const LANE_BYTES = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * CHANNELS;
/** MoveNet SinglePose output: [1, 1, 17, 3] float32 as (y, x, score). */
export const MODEL_OUTPUT_LENGTH = KEYPOINT_COUNT * 3;

export type FrameOrientation = 'up' | 'right' | 'down' | 'left';

/** A rectangle in normalised camera space (0..1 on both axes). */
export interface Roi {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Aspect ratio (width / height) of the frame once rotated upright.
 * The resizer rotates for us, but the raw Frame reports sensor dimensions.
 */
export function uprightAspect(width: number, height: number, orientation: FrameOrientation): number {
  'worklet';
  if (width <= 0 || height <= 0) return 4 / 3;
  return orientation === 'left' || orientation === 'right' ? height / width : width / height;
}

/**
 * Copies one lane out of the resized RGB buffer (`width` × `height`, interleaved) into the
 * 192 × 192 model input. The buffer is already at the lane's scale (see lanes.ts), so this
 * is one native copy per row; pixels outside the buffer are black.
 */
export function copyLane(source: Uint8Array, width: number, height: number, left: number, top: number, target: Uint8Array): void {
  'worklet';
  const size = MODEL_INPUT_SIZE;
  const rowBytes = size * CHANNELS;
  const from = Math.max(0, left);
  const to = Math.min(width, left + size);
  const before = (from - left) * CHANNELS;
  const copied = Math.max(0, to - from) * CHANNELS;
  for (let row = 0; row < size; row++) {
    const t = row * rowBytes;
    const y = top + row;
    if (copied === 0 || y < 0 || y >= height) {
      target.fill(0, t, t + rowBytes);
      continue;
    }
    if (before > 0) target.fill(0, t, t + before);
    const s = (y * width + from) * CHANNELS;
    target.set(source.subarray(s, s + copied), t + before);
    if (before + copied < rowBytes) target.fill(0, t + before + copied, t + rowBytes);
  }
}

/** Converts the model output for one ROI into a pose in camera coordinates (x, y, score). */
export function decodeRoi(output: Float32Array, roi: Roi): number[] {
  'worklet';
  const pose = new Array<number>(POSE_LENGTH);
  for (let k = 0; k < KEYPOINT_COUNT; k++) {
    pose[k * 3] = roi.x + (output[k * 3 + 1] ?? 0) * roi.width;
    pose[k * 3 + 1] = roi.y + (output[k * 3] ?? 0) * roi.height;
    pose[k * 3 + 2] = output[k * 3 + 2] ?? 0;
  }
  return pose;
}
