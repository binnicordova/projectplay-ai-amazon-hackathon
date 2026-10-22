import { describe, expect, it } from 'vitest';
import { applyHomography, calibrationHomography, computeHomography, UNIT_SQUARE, type Quad } from './homography';
import { isPlausibleBody, minTorsoFor } from './body';
import { laneLayout, type LaneLayout } from './lanes';
import { LANE_BYTES, MODEL_INPUT_SIZE, MODEL_OUTPUT_LENGTH, copyLane, decodeRoi, uprightAspect, type Roi } from './moveNet';
import { OneEuroFilter, OneEuroFilter2D } from './oneEuroFilter';
import { estimateHand, raisedHands } from './pointing';
import { KP, bodyMetrics, keypoint, torsoConfidence } from './pose';
import { TEST_ASPECT, jitter, syntheticPose } from './testing/syntheticPose';

const close = (actual: number, expected: number, digits = 4) => expect(actual).toBeCloseTo(expected, digits);

describe('MoveNet lanes', () => {
  it('reports the upright aspect for rotated sensor buffers', () => {
    expect(uprightAspect(1920, 1080, 'up')).toBeCloseTo(16 / 9);
    expect(uprightAspect(1920, 1080, 'right')).toBeCloseTo(9 / 16);
    expect(uprightAspect(0, 0, 'up')).toBeCloseTo(4 / 3);
  });

  /** A width × height RGB buffer whose red channel is the column and green channel the row (mod 256). */
  const gradient = (width: number, height: number) => {
    const source = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        source[i] = x % 256;
        source[i + 1] = y % 256;
        source[i + 2] = 7;
      }
    return source;
  };
  const pixel = (lane: Uint8Array, col: number, row: number) => Array.from(lane.subarray((row * MODEL_INPUT_SIZE + col) * 3, (row * MODEL_INPUT_SIZE + col) * 3 + 3));

  it('copies a lane out of the resized buffer at full resolution', () => {
    const lane = new Uint8Array(LANE_BYTES);
    copyLane(gradient(400, 300), 400, 300, 100, 50, lane);
    expect(pixel(lane, 0, 0)).toEqual([100, 50, 7]);
    expect(pixel(lane, MODEL_INPUT_SIZE - 1, MODEL_INPUT_SIZE - 1)).toEqual([291 % 256, 241, 7]);
  });

  it('fills the part of a lane outside the buffer with black', () => {
    const lane = new Uint8Array(LANE_BYTES).fill(99);
    copyLane(gradient(256, 192), 256, 192, -64, 100, lane);
    expect(pixel(lane, 10, 10)).toEqual([0, 0, 0]); // left of the buffer
    expect(pixel(lane, 64, 10)).toEqual([0, 110, 7]); // first column inside
    expect(pixel(lane, 150, 150)).toEqual([0, 0, 0]); // below the buffer
    copyLane(gradient(256, 192), 256, 192, 128, 0, lane);
    expect(pixel(lane, 127, 5)).toEqual([255, 5, 7]); // last column inside
    expect(pixel(lane, 128, 5)).toEqual([0, 0, 0]); // right of the buffer
  });

  it('maps model coordinates in a region back to camera space', () => {
    const output = new Float32Array(MODEL_OUTPUT_LENGTH);
    // Model output is (y, x, score). Keypoint 0 at the crop centre, keypoint 1 at its top-left.
    output.set([0.5, 0.5, 0.9, 0, 0, 0.8]);
    const roi = { x: 0.2, y: 0.1, width: 0.3, height: 0.6 };
    const pose = decodeRoi(output, roi);
    close(pose[0]!, 0.35);
    close(pose[1]!, 0.4);
    close(pose[2]!, 0.9, 5);
    close(pose[3]!, 0.2);
    close(pose[4]!, 0.1);
  });
});

describe('lane regions', () => {
  // A projection filling the middle of a 16:9 frame, a little keystoned.
  const projection: Quad = [
    { x: 0.3, y: 0.2 },
    { x: 0.72, y: 0.22 },
    { x: 0.7, y: 0.5 },
    { x: 0.32, y: 0.48 },
  ];

  /** Each crop is square in physical pixels, both are the same size, and each is exactly the model input. */
  const expectExactSquareLanes = (layout: LaneLayout, aspect: number) => {
    for (const roi of layout.rois) {
      close(roi.width * aspect, roi.height, 2);
      close(roi.width * layout.sourceWidth, MODEL_INPUT_SIZE, 6);
      close(roi.height * layout.sourceHeight, MODEL_INPUT_SIZE, 6);
    }
    layout.rois.forEach((roi, i) => {
      close(roi.x * layout.sourceWidth, layout.origins[i]!.x, 6);
      close(roi.y * layout.sourceHeight, layout.origins[i]!.y, 6);
    });
  };

  it('splits the camera image in halves before calibration', () => {
    const layout = laneLayout(null, 4 / 3);
    expectExactSquareLanes(layout, 4 / 3);
    const [left, right] = layout.rois as [Roi, Roi];
    close(left.x + left.width, 0.5, 2);
    close(right.x, 0.5, 2);
    close(left.height, 1, 2);
  });

  it("splits at the projection's centre, not the camera's", () => {
    // Perspective-correct centre: a little left of halfway between the corners (0.51). See teamZones.test.ts.
    const [left, right] = laneLayout(projection, 16 / 9).rois as [Roi, Roi];
    close(left.x + left.width, 0.5093, 2);
    close(right.x, 0.5093, 2);
  });

  it('makes both crops square, the same size, and exactly one model input each', () => {
    expectExactSquareLanes(laneLayout(projection, 16 / 9), 16 / 9);
  });

  it('includes room above the projection for raised hands and below it for the body', () => {
    const [left] = laneLayout(projection, 16 / 9).rois as [Roi, Roi];
    expect(left.y).toBeLessThan(0.2);
    expect(left.y + left.height).toBeGreaterThan(0.6);
  });

  it('pads past the image edge instead of squashing the child', () => {
    // A projection near the left edge: the left crop needs more room than the image has.
    const nearEdge: Quad = [
      { x: 0.05, y: 0.25 },
      { x: 0.6, y: 0.25 },
      { x: 0.6, y: 0.6 },
      { x: 0.05, y: 0.6 },
    ];
    const layout = laneLayout(nearEdge, 4 / 3);
    expect(layout.rois[0]!.x).toBeLessThan(0);
    expectExactSquareLanes(layout, 4 / 3);
  });

  describe('one player', () => {
    // An undistorted 16:9 projection 0.3 image-heights tall in a 4:3 camera image.
    const wide: Quad = [
      { x: 0.3, y: 0.2 },
      { x: 0.7, y: 0.2 },
      { x: 0.7, y: 0.5 },
      { x: 0.3, y: 0.5 },
    ];

    it('looks at the whole projection with one exact square crop, centred on the split line', () => {
      const layout = laneLayout(projection, 16 / 9, 1);
      expect(layout.rois).toHaveLength(1);
      expectExactSquareLanes(layout, 16 / 9);
      const [lane] = layout.rois as [Roi];
      close(lane.x + lane.width / 2, 0.5093, 2);
      // Both edges of the projection, so a child reaching the outer tiles stays in view.
      expect(lane.x).toBeLessThan(Math.min(...projection.map((c) => c.x)));
      expect(lane.x + lane.width).toBeGreaterThan(Math.max(...projection.map((c) => c.x)));
    });

    it('gives the child nearly as many pixels as a team lane: the body below the projection sets the size', () => {
      const team = laneLayout(wide, 4 / 3).rois[0]!;
      const whole = laneLayout(wide, 4 / 3, 1).rois[0]!;
      // Side in projection heights: ~1.85 for a team's half, ~2.2 for the whole wall.
      close(team.height / 0.3, 1.85, 2);
      close(whole.height / 0.3, 2.2, 1);
      expect(team.height / whole.height).toBeGreaterThan(0.8);
    });

    it('also covers the whole camera image before calibration', () => {
      const [lane] = laneLayout(null, 4 / 3, 1).rois as [Roi];
      expectExactSquareLanes(laneLayout(null, 4 / 3, 1), 4 / 3);
      expect(lane.x).toBeLessThanOrEqual(0.01);
      expect(lane.x + lane.width).toBeGreaterThanOrEqual(0.99);
    });
  });
});

describe('homography', () => {
  it('is the identity for the unit square', () => {
    const h = computeHomography(UNIT_SQUARE, UNIT_SQUARE)!;
    const p = applyHomography(h, { x: 0.3, y: 0.7 })!;
    close(p.x, 0.3);
    close(p.y, 0.7);
  });

  it('maps a perspective-distorted projection back to the unit square', () => {
    // The projection as seen by a phone placed low and to the left.
    const camera: Quad = [
      { x: 0.2, y: 0.15 },
      { x: 0.85, y: 0.1 },
      { x: 0.8, y: 0.7 },
      { x: 0.25, y: 0.62 },
    ];
    const h = calibrationHomography(camera)!;
    expect(h).not.toBeNull();
    camera.forEach((corner, i) => {
      const mapped = applyHomography(h, corner)!;
      close(mapped.x, UNIT_SQUARE[i]!.x);
      close(mapped.y, UNIT_SQUARE[i]!.y);
    });
    // The intersection of the diagonals is the projection centre.
    const centre = applyHomography(h, intersect(camera[0], camera[2], camera[1], camera[3]))!;
    close(centre.x, 0.5);
    close(centre.y, 0.5);
  });

  it('rejects taps in the wrong order or collapsed quads', () => {
    const crossed: Quad = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.8, y: 0.2 },
      { x: 0.2, y: 0.8 },
    ];
    expect(calibrationHomography(crossed)).toBeNull();
    const collapsed: Quad = [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.3 },
      { x: 0.4, y: 0.4 },
    ];
    expect(calibrationHomography(collapsed)).toBeNull();
  });
});

function intersect(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

describe('One Euro filter', () => {
  it('passes a constant signal through unchanged', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 30; i++) close(f.filter(0.5, i / 15), 0.5);
  });

  it.each([7, 15])('removes a good part of the jitter from a still hand at %i Hz', (hz) => {
    const f = new OneEuroFilter();
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 150; i++) {
      const x = 0.5 + jitter(i, 0.02);
      raw.push(x);
      out.push(f.filter(x, i / hz));
    }
    const spread = (xs: number[]) => Math.max(...xs.slice(30)) - Math.min(...xs.slice(30));
    expect(spread(out)).toBeLessThan(spread(raw) * 0.8);
  });

  it('is on the tile one update after the hand stops, at the ~7 updates per second of a warm phone', () => {
    const f = new OneEuroFilter();
    const hz = 7;
    for (let i = 0; i < 10; i++) f.filter(0.3, i / hz);
    // A reach of 0.4 of the wall in half a second, then the hand rests on the tile.
    for (let i = 1; i <= 4; i++) f.filter(0.3 + 0.1 * i, (9 + i) / hz);
    // 0.0032 off with this tuning; the previous one (0.8, 5, 1.5) was 0.0061 off.
    expect(0.7 - f.filter(0.7, 14 / hz)).toBeLessThan(0.004);
  });

  it('is nearly on the tile when the hand arrives, not a few frames later', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 10; i++) f.filter(0.3, i / 15);
    // A child's reach: 0.4 of the wall in 4 frames at 15 Hz.
    let out = 0;
    for (let i = 1; i <= 4; i++) out = f.filter(0.3 + 0.1 * i, (9 + i) / 15);
    // 93% of the way with this tuning; the previous one (0.6, 1.5, 1) was at 81% and felt laggy.
    expect((out - 0.3) / 0.4).toBeGreaterThan(0.88);
  });

  it('follows a fast reach without lagging for long', () => {
    const f = new OneEuroFilter2D();
    let p = { x: 0.1, y: 0.1 };
    for (let i = 0; i < 5; i++) p = f.filter({ x: 0.1, y: 0.1 }, i / 15);
    for (let i = 5; i < 15; i++) p = f.filter({ x: 0.9, y: 0.5 }, i / 15);
    expect(p.x).toBeGreaterThan(0.85);
    expect(p.y).toBeGreaterThan(0.45);
  });
});

describe('pose metrics', () => {
  it('measures the torso and rejects unreliable poses', () => {
    const body = bodyMetrics(syntheticPose(), TEST_ASPECT)!;
    close(body.torso, 0.2);
    close(body.shoulderWidth, 0.08 * TEST_ASPECT);
    expect(bodyMetrics(syntheticPose({ score: 0.1 }), TEST_ASPECT)).toBeNull();
    expect(torsoConfidence(syntheticPose({ score: 0.7 }))).toBeCloseTo(0.7);
  });
});

describe('pointing hand', () => {
  const withScore = (pose: readonly number[], joint: number, score: number) => {
    const copy = [...pose];
    copy[joint * 3 + 2] = score;
    return copy;
  };

  it('extrapolates the hand past the wrist along the forearm', () => {
    const pose = syntheticPose({ arms: 'pointRight' });
    const hand = estimateHand(pose, 'right', TEST_ASPECT)!;
    const wrist = keypoint(pose, KP.rightWrist);
    expect(hand.point.x).toBeGreaterThan(wrist.x);
    expect(hand.point.y).toBeLessThan(wrist.y);
  });

  it('falls back to the wrist when the elbow is hidden', () => {
    const pose = withScore(syntheticPose({ arms: 'pointRight' }), KP.rightElbow, 0.05);
    const hand = estimateHand(pose, 'right', TEST_ASPECT)!;
    const wrist = keypoint(pose, KP.rightWrist);
    expect(hand.point).toEqual({ x: wrist.x, y: wrist.y });
    expect(hand.confidence).toBeLessThan(wrist.score);
  });

  it('accepts a faint wrist on a clearly visible body', () => {
    // From behind, a hand on a bright tile scores ~0.16 while the body scores well.
    const hand = estimateHand(withScore(syntheticPose({ arms: 'pointRight' }), KP.rightWrist, 0.16), 'right', TEST_ASPECT);
    expect(hand).not.toBeNull();
  });

  it('ignores a wrist further away than an arm can reach', () => {
    const pose = [...syntheticPose({ arms: 'pointRight' })];
    pose[KP.rightWrist * 3] = 0.95; // 0.8 of the image away from the shoulder: 7 torsos
    pose[KP.rightElbow * 3 + 2] = 0.05; // and no elbow to fall back on
    expect(estimateHand(pose, 'right', TEST_ASPECT)).toBeNull();
  });

  it('follows a lifted elbow when the wrist is lost against the projection', () => {
    const pose = withScore(syntheticPose({ arms: 'pointRight' }), KP.rightWrist, 0.05);
    const hand = estimateHand(pose, 'right', TEST_ASPECT)!;
    const elbow = keypoint(pose, KP.rightElbow);
    // About one upper arm beyond the elbow, in the same direction (up and to the right).
    expect(hand.point.x).toBeGreaterThan(elbow.x + 0.05);
    expect(hand.point.y).toBeLessThan(elbow.y - 0.05);
    expect(hand.confidence).toBeLessThan(elbow.score);
  });

  it('never guesses a hand from an elbow hanging by the body', () => {
    expect(estimateHand(withScore(syntheticPose({ arms: 'down' }), KP.rightWrist, 0.05), 'right', TEST_ASPECT)).toBeNull();
  });

  it('reports every raised hand, and ignores arms hanging by the body', () => {
    expect(raisedHands(syntheticPose({ arms: 'pointRight' }), TEST_ASPECT).map((h) => h.side)).toEqual(['right']);
    expect(raisedHands(syntheticPose({ arms: 'up' }), TEST_ASPECT).map((h) => h.side)).toEqual(['left', 'right']);
    expect(raisedHands(syntheticPose({ arms: 'down' }), TEST_ASPECT)).toEqual([]);
  });

  it('returns no hands when no arm is reliably visible', () => {
    expect(raisedHands(syntheticPose({ score: 0.1 }), TEST_ASPECT)).toEqual([]);
  });
});

describe('body check', () => {
  const minTorso = minTorsoFor(UNIT_SQUARE, TEST_ASPECT);

  it('accepts children of any size standing upright', () => {
    expect(isPlausibleBody(syntheticPose(), TEST_ASPECT, minTorso)).toBe(true);
    expect(isPlausibleBody(syntheticPose({ arms: 'up', scale: 0.5 }), TEST_ASPECT, minTorso)).toBe(true);
    expect(isPlausibleBody(syntheticPose({ scale: 2 }), TEST_ASPECT, minTorso)).toBe(true);
  });

  it('rejects the phantom MoveNet finds in an empty lane: every joint in one small blob', () => {
    expect(isPlausibleBody(syntheticPose({ scale: 0.15 }), TEST_ASPECT, minTorso)).toBe(false);
  });

  it('rejects a body upside down or with its shoulders on top of each other', () => {
    const upsideDown = [...syntheticPose()];
    for (const [a, b] of [
      [KP.leftShoulder, KP.leftHip],
      [KP.rightShoulder, KP.rightHip],
    ] as const) {
      const y = upsideDown[a * 3 + 1]!;
      upsideDown[a * 3 + 1] = upsideDown[b * 3 + 1]!;
      upsideDown[b * 3 + 1] = y;
    }
    expect(isPlausibleBody(upsideDown, TEST_ASPECT, minTorso)).toBe(false);

    const sliver = [...syntheticPose()];
    sliver[KP.rightShoulder * 3] = sliver[KP.leftShoulder * 3]!;
    expect(isPlausibleBody(sliver, TEST_ASPECT, minTorso)).toBe(false);
  });

  it('accepts the dim silhouette of a child in front of the projection in a dark room', () => {
    // Torso scores seen on the field: shoulders 0.25 / 0.16, hips 0.20 / 0.12.
    const dim = [...syntheticPose({ arms: 'pointRight', score: 0.3 })];
    [
      [KP.leftShoulder, 0.25],
      [KP.rightShoulder, 0.16],
      [KP.leftHip, 0.2],
      [KP.rightHip, 0.12],
    ].forEach(([joint, score]) => (dim[joint! * 3 + 2] = score!));
    expect(isPlausibleBody(dim, TEST_ASPECT, minTorso)).toBe(true);
  });

  it('rejects a body with a torso it cannot see', () => {
    expect(isPlausibleBody(syntheticPose({ score: 0.1 }), TEST_ASPECT, minTorso)).toBe(false);
    const oneHipMissing = [...syntheticPose()];
    oneHipMissing[KP.rightHip * 3 + 2] = 0.05;
    expect(isPlausibleBody(oneHipMissing, TEST_ASPECT, minTorso)).toBe(false);
  });

  it('scales the smallest plausible child with the projection', () => {
    const small: Quad = [
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
      { x: 0.6, y: 0.5 },
      { x: 0.4, y: 0.5 },
    ];
    expect(minTorsoFor(small, TEST_ASPECT)).toBeCloseTo(0.008);
    expect(minTorsoFor(UNIT_SQUARE, TEST_ASPECT)).toBeCloseTo(0.08);
    expect(minTorsoFor(null, TEST_ASPECT)).toBeCloseTo(0.04);
  });
});
