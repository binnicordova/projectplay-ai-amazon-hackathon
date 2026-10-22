/**
 * Turns raw lane poses (from the camera thread) into the few meaning-level messages the
 * TV needs. Runs on the JS thread; pure TypeScript.
 *
 *   pose ─ body check ─┬─ pointing hand → homography → One Euro → { t: 'ptr' }
 *                      └─ presence tracking                      → { t: 'lost' }
 *
 * The model looks at one lane per camera frame (see laneSchedule.ts), so a frame usually
 * carries one lane's pose; the other lane keeps what it last showed. `busyLanes` tells the
 * camera which lanes have a child, so those get most of the frames.
 *
 * It also returns what it decided for each lane, so the preview shows exactly what the
 * TV receives: a skeleton only for a child it tracks, a ring only for a hand it sends.
 */
import { POINTER_MARGIN, type HandId, type PlayerId, type TeacherMessage } from '@projectplay/contracts';
import { isPlausibleBody, minTorsoFor } from '../domain/body';
import { applyHomography, type Mat3, type Quad } from '../domain/homography';
import { busyLanesOf, type BusyLanes } from '../domain/laneSchedule';
import { LANE_COUNT } from '../domain/moveNet';
import { OneEuroFilter2D } from '../domain/oneEuroFilter';
import { raisedHands, type HandEstimate } from '../domain/pointing';
import type { Point2, Pose } from '../domain/pose';

export interface PoseFrame {
  /**
   * Per camera lane, in camera space: the pose found, null when the model found nobody, or
   * undefined when the model did not look at that lane on this frame (lanes take turns).
   */
  readonly lanes: readonly (Pose | null | undefined)[];
  /** Upright camera aspect ratio (width / height). */
  readonly aspect: number;
  /** Seconds, monotonic. */
  readonly timestamp: number;
  /** Camera-thread time spent on this frame (resize, crops, model), milliseconds. */
  readonly workMs?: number;
}

export interface LaneView {
  /** The tracked child's pose (camera space), or null when nobody is tracked in this lane. */
  readonly pose: Pose | null;
  /** Hands sent to the TV as pointers on this frame, in camera space. */
  readonly pointers: readonly Point2[];
}

export interface PerceptionView {
  readonly lanes: readonly LaneView[];
}

export interface PipelineOptions {
  /**
   * Consecutive frames with a plausible body before a child counts as present. Single-frame
   * phantoms (a flicker on the projected picture) never reach the TV.
   */
  readonly acquireFrames: number;
  /** Consecutive frames of that lane without one before reporting a player as lost (~1 s). */
  readonly lostAfterFrames: number;
}

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = { acquireFrames: 2, lostAfterFrames: 8 };

const handId = (hand: HandEstimate): HandId => (hand.side === 'left' ? 0 : 1);
const EMPTY_LANE: LaneView = { pose: null, pointers: [] };

class PlayerTrack {
  /** One smoothing filter per hand. */
  readonly filters: readonly [OneEuroFilter2D, OneEuroFilter2D] = [new OneEuroFilter2D(), new OneEuroFilter2D()];
  seenFrames = 0;
  missedFrames = 0;
  present = false;
  view: LaneView = EMPTY_LANE;

  /** A child is here, or one was just seen and is being confirmed: give this lane frames. */
  get busy(): boolean {
    return this.present || this.seenFrames > 0;
  }

  resetTracking(): void {
    this.filters.forEach((f) => f.reset());
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class PerceptionPipeline {
  private readonly tracks = new Map<number, PlayerTrack>();
  private homography: Mat3 | null = null;
  private corners: Quad | null = null;
  private laneCount: number = LANE_COUNT;

  constructor(
    private readonly emit: (message: TeacherMessage) => void,
    private readonly options: PipelineOptions = DEFAULT_PIPELINE_OPTIONS,
  ) {}

  /** The homography maps hands onto the wall; the corners say how big a child can be. */
  setCalibration(homography: Mat3 | null, corners: Quad | null): void {
    this.homography = homography;
    this.corners = corners;
    this.tracks.forEach((track) => track.filters.forEach((f) => f.reset()));
  }

  get isCalibrated(): boolean {
    return this.homography !== null;
  }

  /**
   * Two lanes (one per team half) or one over the whole wall (one player). Every lane changes
   * shape, so tracking starts over: children already on the TV are reported lost and come back
   * as soon as their new lane confirms them.
   */
  setLaneCount(count: number): void {
    if (count === this.laneCount) return;
    this.laneCount = count;
    this.tracks.forEach((track, player) => {
      if (track.present) this.emit({ t: 'lost', p: player });
    });
    this.tracks.clear();
  }

  /** Lanes with a child in them (bit per lane), for the camera's lane schedule. */
  get busyLanes(): BusyLanes {
    return busyLanesOf(Array.from({ length: this.laneCount }, (_, lane) => this.track(lane + 1).busy));
  }

  process(frame: PoseFrame): PerceptionView {
    const minTorso = minTorsoFor(this.corners, frame.aspect);
    // A frame from the old layout can still arrive just after a switch: lanes past the count are dropped.
    const lanes = Array.from({ length: this.laneCount }, (_, lane) => {
      const track = this.track(lane + 1);
      const pose = frame.lanes[lane];
      // Not looked at on this frame: keep showing (and tracking) what this lane last saw.
      if (pose !== undefined) track.view = this.processLane(lane + 1, track, pose, frame, minTorso);
      return track.view;
    });
    return { lanes };
  }

  private track(player: PlayerId): PlayerTrack {
    let track = this.tracks.get(player);
    if (!track) {
      track = new PlayerTrack();
      this.tracks.set(player, track);
    }
    return track;
  }

  private processLane(player: PlayerId, track: PlayerTrack, pose: Pose | null, frame: PoseFrame, minTorso: number): LaneView {
    if (!pose || !isPlausibleBody(pose, frame.aspect, minTorso)) {
      track.seenFrames = 0;
      track.missedFrames++;
      if (track.present && track.missedFrames >= this.options.lostAfterFrames) {
        track.present = false;
        track.resetTracking();
        this.emit({ t: 'lost', p: player });
      }
      return EMPTY_LANE;
    }
    track.missedFrames = 0;
    track.seenFrames++;
    if (!track.present && track.seenFrames < this.options.acquireFrames) return EMPTY_LANE;
    track.present = true;

    return { pose, pointers: this.updatePointers(player, track, pose, frame) };
  }

  private updatePointers(player: PlayerId, track: PlayerTrack, pose: Pose, frame: PoseFrame): Point2[] {
    if (!this.homography) return [];
    const raised = raisedHands(pose, frame.aspect);
    const sent: Point2[] = [];
    for (const h of [0, 1] as const) {
      const hand = raised.find((r) => handId(r) === h);
      const filter = track.filters[h];
      const onWall = hand ? applyHomography(this.homography, hand.point) : null;
      const inside =
        onWall !== null &&
        onWall.x >= -POINTER_MARGIN &&
        onWall.x <= 1 + POINTER_MARGIN &&
        onWall.y >= -POINTER_MARGIN &&
        onWall.y <= 1 + POINTER_MARGIN;
      if (!hand || !onWall || !inside) {
        filter.reset();
        continue;
      }
      const smooth = filter.filter(onWall, frame.timestamp);
      sent.push(hand.point);
      this.emit({
        t: 'ptr',
        p: player,
        h,
        x: clamp(smooth.x, -POINTER_MARGIN, 1 + POINTER_MARGIN),
        y: clamp(smooth.y, -POINTER_MARGIN, 1 + POINTER_MARGIN),
        c: clamp(hand.confidence, 0, 1),
      });
    }
    return sent;
  }
}
