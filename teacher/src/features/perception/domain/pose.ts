/**
 * Body pose vocabulary. A pose is a flat array of 17 keypoints × (x, y, score),
 * in *camera* space: x and y normalised to the upright camera image (0..1).
 * Flat number arrays cross the worklet → JS boundary cheaply.
 *
 * The camera stands behind the children, looking at the projected wall, so the
 * model mostly sees their backs: face keypoints are unreliable and never used.
 */

export const KP = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
} as const;

export const KEYPOINT_COUNT = 17;
export const VALUES_PER_KEYPOINT = 3;
export const POSE_LENGTH = KEYPOINT_COUNT * VALUES_PER_KEYPOINT;

/**
 * Minimum per-keypoint score we trust. Classrooms with a projector are dark and children
 * are back-lit, so MoveNet scores run low; 0.2 keeps real joints and drops most noise.
 */
export const MIN_KEYPOINT_SCORE = 0.2;

export type Pose = readonly number[];

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface Keypoint extends Point2 {
  readonly score: number;
}

export function keypoint(pose: Pose, index: number): Keypoint {
  const o = index * VALUES_PER_KEYPOINT;
  return { x: pose[o] ?? 0, y: pose[o + 1] ?? 0, score: pose[o + 2] ?? 0 };
}

export const isReliable = (k: Keypoint, min = MIN_KEYPOINT_SCORE): boolean => k.score >= min;

export const midpoint = (a: Point2, b: Point2): Point2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const distance = (a: Point2, b: Point2): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Camera coordinates are normalised per axis, so a 16:9 frame squashes x.
 * Multiply x by the aspect ratio to get an isotropic space where distances
 * are comparable in every direction.
 */
export const toIsotropic = (p: Point2, aspect: number): Point2 => ({ x: p.x * aspect, y: p.y });

export interface BodyMetrics {
  readonly shoulderMid: Point2;
  readonly hipMid: Point2;
  /** Distance between shoulders, isotropic units. */
  readonly shoulderWidth: number;
  /** Distance from mid-shoulders to mid-hips, isotropic units. Our body-size yardstick. */
  readonly torso: number;
}

/**
 * Torso geometry in isotropic camera space, or null when the torso is not visible enough.
 * `minScore` is lower once body.ts has confirmed the child: then a faint torso is still a fine yardstick.
 */
export function bodyMetrics(pose: Pose, aspect: number, minScore = MIN_KEYPOINT_SCORE): BodyMetrics | null {
  const ls = keypoint(pose, KP.leftShoulder);
  const rs = keypoint(pose, KP.rightShoulder);
  const lh = keypoint(pose, KP.leftHip);
  const rh = keypoint(pose, KP.rightHip);
  if (![ls, rs, lh, rh].every((k) => isReliable(k, minScore))) return null;
  const shoulderMid = toIsotropic(midpoint(ls, rs), aspect);
  const hipMid = toIsotropic(midpoint(lh, rh), aspect);
  const torso = distance(shoulderMid, hipMid);
  if (torso < 1e-3) return null;
  return {
    shoulderMid,
    hipMid,
    shoulderWidth: distance(toIsotropic(ls, aspect), toIsotropic(rs, aspect)),
    torso,
  };
}

/** Mean score of the four torso keypoints: a cheap "is a child really here?" signal. */
export function torsoConfidence(pose: Pose): number {
  const ids = [KP.leftShoulder, KP.rightShoulder, KP.leftHip, KP.rightHip];
  return ids.reduce((sum, id) => sum + keypoint(pose, id).score, 0) / ids.length;
}
