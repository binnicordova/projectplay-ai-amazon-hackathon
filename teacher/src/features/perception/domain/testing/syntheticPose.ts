/**
 * Synthetic poses for unit tests, in camera space (x, y normalised; 16:9 frame).
 * A child seen from behind, standing centred at `cx`.
 */
import { KEYPOINT_COUNT, KP, VALUES_PER_KEYPOINT, type Point2, type Pose } from '../pose';

export const TEST_ASPECT = 16 / 9;

export type Arms = 'down' | 'up' | 'crossed' | 'pointRight' | 'pointLeft';

export interface PoseOptions {
  readonly cx?: number;
  /** Vertical offset of the whole body (negative = higher, e.g. on tiptoe). */
  readonly dy?: number;
  readonly arms?: Arms;
  readonly score?: number;
  /** Uniform scale around the hips (bigger = closer to the camera). */
  readonly scale?: number;
}

export function syntheticPose({ cx = 0.5, dy = 0, arms = 'down', score = 0.9, scale = 1 }: PoseOptions = {}): Pose {
  const pose = new Array<number>(KEYPOINT_COUNT * VALUES_PER_KEYPOINT).fill(0);
  const hipY = 0.6 + dy;
  const set = (index: number, p: Point2, s = score) => {
    const x = cx + (p.x - cx) * scale;
    const y = hipY + (p.y - hipY) * scale;
    pose[index * 3] = x;
    pose[index * 3 + 1] = y;
    pose[index * 3 + 2] = s;
  };
  // Seen from behind: the child's left side appears on the image left.
  set(KP.nose, { x: cx, y: 0.32 + dy }, 0.1);
  set(KP.leftShoulder, { x: cx - 0.04, y: 0.4 + dy });
  set(KP.rightShoulder, { x: cx + 0.04, y: 0.4 + dy });
  set(KP.leftHip, { x: cx - 0.03, y: hipY });
  set(KP.rightHip, { x: cx + 0.03, y: hipY });
  set(KP.leftKnee, { x: cx - 0.03, y: 0.72 + dy });
  set(KP.rightKnee, { x: cx + 0.03, y: 0.72 + dy });
  set(KP.leftAnkle, { x: cx - 0.03, y: 0.84 + dy });
  set(KP.rightAnkle, { x: cx + 0.03, y: 0.84 + dy });

  const arm = (elbow: number, wrist: number, e: Point2, w: Point2) => {
    set(elbow, e);
    set(wrist, w);
  };
  switch (arms) {
    case 'down':
      arm(KP.leftElbow, KP.leftWrist, { x: cx - 0.06, y: 0.5 + dy }, { x: cx - 0.06, y: 0.6 + dy });
      arm(KP.rightElbow, KP.rightWrist, { x: cx + 0.06, y: 0.5 + dy }, { x: cx + 0.06, y: 0.6 + dy });
      break;
    case 'up':
      arm(KP.leftElbow, KP.leftWrist, { x: cx - 0.05, y: 0.3 + dy }, { x: cx - 0.05, y: 0.2 + dy });
      arm(KP.rightElbow, KP.rightWrist, { x: cx + 0.05, y: 0.3 + dy }, { x: cx + 0.05, y: 0.2 + dy });
      break;
    case 'crossed':
      arm(KP.leftElbow, KP.leftWrist, { x: cx - 0.07, y: 0.5 + dy }, { x: cx + 0.01, y: 0.48 + dy });
      arm(KP.rightElbow, KP.rightWrist, { x: cx + 0.07, y: 0.5 + dy }, { x: cx - 0.01, y: 0.48 + dy });
      break;
    case 'pointRight':
      arm(KP.leftElbow, KP.leftWrist, { x: cx - 0.06, y: 0.5 + dy }, { x: cx - 0.06, y: 0.6 + dy });
      arm(KP.rightElbow, KP.rightWrist, { x: cx + 0.1, y: 0.33 + dy }, { x: cx + 0.16, y: 0.26 + dy });
      break;
    case 'pointLeft':
      arm(KP.leftElbow, KP.leftWrist, { x: cx - 0.1, y: 0.33 + dy }, { x: cx - 0.16, y: 0.26 + dy });
      arm(KP.rightElbow, KP.rightWrist, { x: cx + 0.06, y: 0.5 + dy }, { x: cx + 0.06, y: 0.6 + dy });
      break;
  }
  return pose;
}

/** Deterministic pseudo-noise in [-amplitude, amplitude]. */
export function jitter(seed: number, amplitude: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amplitude;
}
