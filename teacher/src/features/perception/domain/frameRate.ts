/**
 * How fast perception really runs on this phone. Every stage after the camera (smoothing,
 * dwell, cursor glide) is tuned for ~15 Hz; below ~10 Hz pointers feel laggy whatever the
 * filters do, usually because a long exposure (low-light boost) or a busy phone slows frames.
 */

export interface FrameRate {
  /** Frames per second reaching the pipeline. */
  readonly fps: number;
  /** Camera-thread time per frame (resize, crops, model), milliseconds. */
  readonly workMs: number;
}

/** Below this, the teacher is told the camera is slow (see the class screen). */
export const SLOW_FPS = 10;

/** Exponential moving average: ~1 s memory at 15 Hz, cheap enough for every frame. */
const SMOOTHING = 0.1;

export class FrameRateMeter {
  private lastTimestamp: number | null = null;
  private interval: number | null = null;
  private work = 0;

  /** @param timestamp seconds, monotonic */
  add(timestamp: number, workMs: number): void {
    if (this.lastTimestamp !== null) {
      const dt = timestamp - this.lastTimestamp;
      // A pause (screen change, app in background) is not a slow frame.
      if (dt > 0 && dt < 1) this.interval = this.interval === null ? dt : this.interval + SMOOTHING * (dt - this.interval);
    }
    this.lastTimestamp = timestamp;
    this.work = this.work === 0 ? workMs : this.work + SMOOTHING * (workMs - this.work);
  }

  get rate(): FrameRate | null {
    return this.interval === null ? null : { fps: 1 / this.interval, workMs: this.work };
  }
}
