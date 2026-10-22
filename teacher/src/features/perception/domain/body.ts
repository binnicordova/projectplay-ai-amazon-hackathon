/**
 * Is this pose a child, or MoveNet seeing a body in the picture?
 *
 * MoveNet SinglePose always returns 17 keypoints, even for an empty lane, and the bright
 * projected tiles (or a chair in the dark) can score as high as a back-lit child. Scores
 * alone cannot tell them apart; shape can. Phantoms collapse into a blob (torso 0.06 of the
 * projection's height), stand on their heads, or have both shoulders in one spot.
 *
 * So the score bar is low and the shape decides. A child in a dark room is a silhouette in
 * front of the projection with legs in the dark, and the torso scores 0.12–0.36. On 14 field
 * lanes (5 with a person, 9 empty), this gate found 3 people and passed no phantom; requiring
 * every torso joint at 0.2 found 1.
 */
import type { Quad } from './homography';
import { bodyMetrics, distance, toIsotropic, torsoConfidence, type Pose } from './pose';

export const BODY_GATE = {
  /** Each torso joint (shoulders, hips) must score at least this... */
  minJointScore: 0.1,
  /** ...and the four together at least this on average. */
  minMeanScore: 0.15,
  /** Smallest torso, as a fraction of the projection's height in the camera picture. */
  minTorsoOfProjection: 0.08,
  /** Smallest torso before calibration, as a fraction of the camera image height. */
  minTorsoUncalibrated: 0.04,
  /** Hips must be below the shoulders by this fraction of the torso (leaning is fine, upside down is not). */
  minUpright: 0.5,
  /** Shoulder width as a fraction of the torso: from behind both shoulders are apart. */
  minShoulderWidth: 0.15,
} as const;

/** Smallest plausible torso length (isotropic camera units) for a calibrated projection. */
export function minTorsoFor(corners: Quad | null, aspect: number): number {
  if (!corners) return BODY_GATE.minTorsoUncalibrated;
  const [tl, tr, br, bl] = corners.map((c) => toIsotropic(c, aspect)) as unknown as Quad;
  const projectionHeight = (distance(tl, bl) + distance(tr, br)) / 2;
  return BODY_GATE.minTorsoOfProjection * projectionHeight;
}

export function isPlausibleBody(pose: Pose, aspect: number, minTorso: number): boolean {
  if (torsoConfidence(pose) < BODY_GATE.minMeanScore) return false;
  const body = bodyMetrics(pose, aspect, BODY_GATE.minJointScore);
  if (!body || body.torso < minTorso) return false;
  return body.hipMid.y - body.shoulderMid.y >= BODY_GATE.minUpright * body.torso && body.shoulderWidth >= BODY_GATE.minShoulderWidth * body.torso;
}
