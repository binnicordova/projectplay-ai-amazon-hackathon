import type { TeacherMessage } from '@mimikai/contracts';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { containRect, cameraToView, frameRect, viewToCamera } from '../domain/previewGeometry';
import { computeHomography, UNIT_SQUARE } from '../domain/homography';
import { TEST_ASPECT, syntheticPose } from '../domain/testing/syntheticPose';
import { addCornerAtom, calibrationAtom, calibrationErrorAtom, homographyAtom } from './calibration';
import { DEFAULT_PIPELINE_OPTIONS, PerceptionPipeline, type PoseFrame } from './perceptionPipeline';

const identity = computeHomography(UNIT_SQUARE, UNIT_SQUARE)!;

function setup() {
  const sent: TeacherMessage[] = [];
  const pipeline = new PerceptionPipeline((m) => sent.push(m));
  let t = 0;
  const feed = (lanes: PoseFrame['lanes'], frames = 1) => {
    let view = pipeline.process({ lanes, aspect: TEST_ASPECT, timestamp: (t += 1 / 15) });
    for (let i = 1; i < frames; i++) view = pipeline.process({ lanes, aspect: TEST_ASPECT, timestamp: (t += 1 / 15) });
    return view;
  };
  return { sent, pipeline, feed };
}

const pointersOf = (sent: TeacherMessage[]) => sent.filter((m): m is Extract<TeacherMessage, { t: 'ptr' }> => m.t === 'ptr');

describe('PerceptionPipeline', () => {
  it('sends no pointers until the projection is calibrated', () => {
    const { sent, feed } = setup();
    feed([syntheticPose({ arms: 'pointRight' }), null], 5);
    expect(sent.filter((m) => m.t === 'ptr')).toHaveLength(0);
  });

  it('streams a smoothed pointer per lane once calibrated, from the second frame a child is seen', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    feed([syntheticPose({ cx: 0.25, arms: 'pointRight' }), syntheticPose({ cx: 0.75, arms: 'pointLeft' })], 5);
    const pointers = pointersOf(sent);
    expect(pointers.filter((m) => m.p === 1)).toHaveLength(4);
    expect(pointers.filter((m) => m.p === 2)).toHaveLength(4);
    const lastLeftLane = pointers.filter((m) => m.p === 1).at(-1)!;
    expect(lastLeftLane.x).toBeGreaterThan(0.25);
    expect(lastLeftLane.y).toBeLessThan(0.4);
  });

  it('streams both hands of one child as separate pointers', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    feed([syntheticPose({ cx: 0.25, arms: 'up' }), null], 3);
    const pointers = pointersOf(sent);
    expect(pointers.filter((m) => m.h === 0)).toHaveLength(2);
    expect(pointers.filter((m) => m.h === 1)).toHaveLength(2);
    expect(pointers.at(-2)!.x).toBeLessThan(pointers.at(-1)!.x);
  });

  it('reports a player lost after ~0.5 s without a body, once', () => {
    const { sent, feed } = setup();
    feed([syntheticPose(), null], 2);
    feed([null, null], 20);
    expect(sent.filter((m) => m.t === 'lost')).toEqual([{ t: 'lost', p: 1 }]);
  });

  it('never sends the phantom MoveNet finds in an empty lane, and does not draw it', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    // Every joint bunched up on one projected tile, with good scores.
    const view = feed([syntheticPose({ cx: 0.3, scale: 0.15, arms: 'up' }), null], 30);
    expect(sent).toEqual([]);
    expect(view.lanes[0]).toEqual({ pose: null, pointers: [] });
  });

  it('ignores a body that flickers into view for a single frame', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    for (let i = 0; i < 10; i++) {
      feed([syntheticPose({ arms: 'up' }), null]);
      feed([null, null]);
    }
    expect(sent).toEqual([]);
  });

  it('shows on the preview exactly the child and the hands the TV receives', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    const view = feed([syntheticPose({ cx: 0.25, arms: 'pointRight' }), null], 3);
    expect(view.lanes[0]!.pose).not.toBeNull();
    expect(view.lanes[0]!.pointers).toHaveLength(1);
    expect(view.lanes[1]).toEqual({ pose: null, pointers: [] });
    expect(pointersOf(sent).at(-1)!.p).toBe(1);
  });

  it('tracks both children when the model looks at one lane per frame', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    const left = syntheticPose({ cx: 0.25, arms: 'pointRight' });
    const right = syntheticPose({ cx: 0.75, arms: 'pointLeft' });
    let view = feed([left, undefined]);
    for (let i = 0; i < 6; i++) {
      view = feed([undefined, right]);
      view = feed([left, undefined]);
    }
    // The lane skipped on the last frame still shows its child (no flicker in the preview).
    expect(view.lanes[0]!.pose).not.toBeNull();
    expect(view.lanes[1]!.pose).not.toBeNull();
    const pointers = pointersOf(sent);
    expect(pointers.filter((m) => m.p === 1)).toHaveLength(6);
    expect(pointers.filter((m) => m.p === 2)).toHaveLength(5);
    expect(sent.filter((m) => m.t === 'lost')).toEqual([]);
  });

  it('counts a lane as lost only from the frames that looked at it', () => {
    const { sent, feed } = setup();
    feed([syntheticPose(), undefined], 2);
    // Many frames for the other lane: lane 1 was not looked at, so its child is not lost.
    feed([undefined, null], 30);
    expect(sent.filter((m) => m.t === 'lost')).toEqual([]);
    feed([null, undefined], DEFAULT_PIPELINE_OPTIONS.lostAfterFrames);
    expect(sent.filter((m) => m.t === 'lost')).toEqual([{ t: 'lost', p: 1 }]);
  });

  it('tells the camera which lanes have a child, including one being confirmed', () => {
    const { pipeline, feed } = setup();
    expect(pipeline.busyLanes).toBe(0);
    feed([undefined, syntheticPose({ cx: 0.75 })]);
    expect(pipeline.busyLanes).toBe(0b10);
    feed([syntheticPose({ cx: 0.25 }), undefined], 2);
    expect(pipeline.busyLanes).toBe(0b11);
    feed([undefined, null], DEFAULT_PIPELINE_OPTIONS.lostAfterFrames);
    expect(pipeline.busyLanes).toBe(0b01);
  });

  it('tracks one player anywhere on the wall with a single lane, including the middle', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    pipeline.setLaneCount(1);
    const view = feed([syntheticPose({ cx: 0.5, arms: 'up' })], 3);
    expect(view.lanes).toHaveLength(1);
    expect(view.lanes[0]!.pose).not.toBeNull();
    expect(new Set(pointersOf(sent).map((m) => m.p))).toEqual(new Set([1]));
    expect(pipeline.busyLanes).toBe(0b1);
  });

  it('reports children lost and starts over when the lanes change, and ignores a frame of the old layout', () => {
    const { sent, pipeline, feed } = setup();
    pipeline.setCalibration(identity, UNIT_SQUARE);
    feed([syntheticPose({ cx: 0.25 }), syntheticPose({ cx: 0.75 })], 2);
    pipeline.setLaneCount(1);
    expect(sent.filter((m) => m.t === 'lost')).toEqual([
      { t: 'lost', p: 1 },
      { t: 'lost', p: 2 },
    ]);
    // The camera may still deliver a two-lane frame: the second lane is not a player any more.
    sent.length = 0;
    const view = feed([syntheticPose({ cx: 0.5, arms: 'up' }), syntheticPose({ cx: 0.75, arms: 'up' })], 3);
    expect(view.lanes).toHaveLength(1);
    expect(pointersOf(sent).every((m) => m.p === 1)).toBe(true);
    expect(pipeline.busyLanes).toBe(0b1);
    // Same count again: nothing is reset.
    pipeline.setLaneCount(1);
    expect(sent.filter((m) => m.t === 'lost')).toEqual([]);
  });
});

describe('calibration', () => {
  it('commits four clockwise corners and derives a homography', () => {
    const store = createStore();
    [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ].forEach((p) => store.set(addCornerAtom, p));
    expect(store.get(calibrationAtom)).not.toBeNull();
    expect(store.get(homographyAtom)).not.toBeNull();
  });

  it('rejects corners tapped in the wrong order and asks again', () => {
    const store = createStore();
    [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.8, y: 0.2 },
      { x: 0.2, y: 0.8 },
    ].forEach((p) => store.set(addCornerAtom, p));
    expect(store.get(calibrationAtom)).toBeNull();
    expect(store.get(calibrationErrorAtom)).toMatch(/clockwise/);
  });
});

describe('preview geometry', () => {
  it('letterboxes a 16:9 image in a wider view and maps taps both ways', () => {
    const rect = containRect(2000, 900, 16 / 9);
    expect(rect.height).toBe(900);
    expect(rect.width).toBeCloseTo(1600);
    expect(rect.x).toBeCloseTo(200);
    const camera = viewToCamera({ x: 1000, y: 450 }, rect)!;
    expect(camera.x).toBeCloseTo(0.5);
    expect(camera.y).toBeCloseTo(0.5);
    expect(cameraToView(camera, rect).x).toBeCloseTo(1000);
    expect(viewToCamera({ x: 100, y: 450 }, rect)).toBeNull();
  });

  it('draws 4:3 frames exactly over the 4:3 preview', () => {
    expect(frameRect(2340, 1080, 4 / 3)).toEqual(containRect(2340, 1080, 4 / 3));
  });

  it('draws 16:9 frames on the centred band of a 4:3 preview, not over the whole view', () => {
    // The bug this fixes: overlays stretched over 1920 px while the preview image is 1440 px wide.
    const rect = frameRect(2340, 1080, 16 / 9);
    expect(rect.x).toBeCloseTo(450);
    expect(rect.width).toBeCloseTo(1440);
    expect(rect.height).toBeCloseTo(810);
    expect(rect.y).toBeCloseTo(135);
    // The frame centre is the preview centre; a frame corner is inside the preview image.
    expect(cameraToView({ x: 0.5, y: 0.5 }, rect)).toEqual({ x: 1170, y: 540 });
    expect(viewToCamera({ x: 1170, y: 60 }, rect)).toBeNull(); // preview area the frames never see
  });
});
