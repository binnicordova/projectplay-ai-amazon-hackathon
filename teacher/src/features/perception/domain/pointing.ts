/**
 * Turns a body pose into "where are this child's hands on the wall".
 * MoveNet has no finger keypoints, so a hand is extrapolated past the wrist along the
 * forearm (or is the wrist itself when the elbow is hidden, which is common from behind).
 * Both hands are reported: children touch with whichever hand is closer, and if one
 * hand is occluded the other still works.
 *
 * Only call this for a pose that passed the body check (body.ts): knowing the child is
 * there lets a weaker wrist count, as long as it is within arm's reach of its shoulder.
 */
import { BODY_GATE } from './body';
import { KP, bodyMetrics, distance, isReliable, keypoint, midpoint, toIsotropic, type Point2, type Pose } from './pose';

/** Hand ≈ wrist + 30% of the forearm vector (palm and fingers). */
export const HAND_EXTENSION = 0.3;
/**
 * Wrist score accepted on a confirmed body. Wrists are the weakest joints from behind: on the
 * field screenshots a child touching a tile scored 0.12–0.16 there, against 0.25–0.43 at the elbow.
 */
export const MIN_HAND_SCORE = 0.15;
/** A wrist further than this many torso lengths from its shoulder is noise (a child's arm is ~1.5). */
export const MAX_REACH = 2;
/**
 * Arm stretched against the bright projection: the forearm vanishes in the glare and the wrist
 * is lost first. A lifted elbow still says where the hand is: about one upper arm further on.
 */
export const ELBOW_REACH = 1.1;
/** The elbow counts as lifted when at most this many torso lengths below its shoulder. */
const LIFTED_ELBOW = 0.25;

export type Side = 'left' | 'right';
export const SIDES: readonly Side[] = ['left', 'right'];

export interface HandEstimate {
  readonly side: Side;
  readonly point: Point2;
  readonly confidence: number;
}

const JOINTS = {
  left: { shoulder: KP.leftShoulder, elbow: KP.leftElbow, wrist: KP.leftWrist },
  right: { shoulder: KP.rightShoulder, elbow: KP.rightElbow, wrist: KP.rightWrist },
} as const;

export function estimateHand(pose: Pose, side: Side, aspect: number): HandEstimate | null {
  const joints = JOINTS[side];
  const shoulder = keypoint(pose, joints.shoulder);
  const elbow = keypoint(pose, joints.elbow);
  const wrist = keypoint(pose, joints.wrist);
  const torso = bodyMetrics(pose, aspect, BODY_GATE.minJointScore)?.torso ?? null;
  const withinReach =
    torso === null || !isReliable(shoulder) || distance(toIsotropic(shoulder, aspect), toIsotropic(wrist, aspect)) <= MAX_REACH * torso;

  if (isReliable(wrist, MIN_HAND_SCORE) && withinReach) {
    if (!isReliable(elbow, MIN_HAND_SCORE)) {
      // Elbow hidden behind the body: the wrist alone is still a good pointer.
      return { side, point: { x: wrist.x, y: wrist.y }, confidence: wrist.score * 0.8 };
    }
    return {
      side,
      point: { x: wrist.x + HAND_EXTENSION * (wrist.x - elbow.x), y: wrist.y + HAND_EXTENSION * (wrist.y - elbow.y) },
      confidence: Math.min(wrist.score, elbow.score),
    };
  }
  if (torso !== null && isReliable(shoulder) && isReliable(elbow) && elbow.y - shoulder.y <= LIFTED_ELBOW * torso) {
    return {
      side,
      point: { x: elbow.x + ELBOW_REACH * (elbow.x - shoulder.x), y: elbow.y + ELBOW_REACH * (elbow.y - shoulder.y) },
      confidence: Math.min(elbow.score, shoulder.score) * 0.6,
    };
  }
  return null;
}

/**
 * Hands that are raised (above the hips), so arms hanging by the body never answer.
 * If the hips are not visible we cannot tell, so every detected hand is returned.
 */
export function raisedHands(pose: Pose, aspect: number): HandEstimate[] {
  const lh = keypoint(pose, KP.leftHip);
  const rh = keypoint(pose, KP.rightHip);
  const hipY = isReliable(lh) && isReliable(rh) ? midpoint(lh, rh).y : isReliable(lh) ? lh.y : isReliable(rh) ? rh.y : Infinity;
  return SIDES.map((side) => estimateHand(pose, side, aspect)).filter((h): h is HandEstimate => h !== null && h.point.y < hipY);
}
