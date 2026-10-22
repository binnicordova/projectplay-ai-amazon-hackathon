/**
 * One Euro filter (Casiez, Roussel, Vogel — CHI 2012): adaptive low-pass that
 * removes jitter when the hand is still and stays responsive when it moves fast.
 * Defaults are tuned for normalised projection coordinates at the 5–10 updates per second
 * each child gets on a warm phone (lanes take turns on the model, see laneSchedule.ts).
 */
import type { Point2 } from './pose';

const smoothingFactor = (cutoffHz: number, dtSeconds: number): number => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
};

export interface OneEuroOptions {
  /** Cutoff when still. Lower = smoother but laggier. */
  readonly minCutoff: number;
  /** How quickly the cutoff opens up with speed. Higher = less lag when moving. */
  readonly beta: number;
  readonly derivativeCutoff: number;
}

/**
 * Tuned by simulation at the rates measured on the Galaxy A26 (6.7 updates per second per child
 * with two children, ~10 with one), MoveNet-like noise (σ 0.012) and a 0.4 reach in 0.5 s:
 * the cursor settles on the tile 48 ms (median) after the hand stops, against 66 ms with the
 * previous tuning (0.8, 5, 1.5), and 113 ms when both lanes still ran on every frame. The
 * price is jitter: 0.0072 left instead of 0.0059, tiny next to a tile (0.2 wide) and absorbed
 * by the dwell. Lag is what children notice: they chase a cursor that trails their hand.
 */
export const DEFAULT_ONE_EURO: OneEuroOptions = { minCutoff: 1.2, beta: 8, derivativeCutoff: 2 };

export class OneEuroFilter {
  private value: number | null = null;
  private derivative = 0;
  private lastTime = 0;

  constructor(private readonly options: OneEuroOptions = DEFAULT_ONE_EURO) {}

  filter(x: number, timeSeconds: number): number {
    if (this.value === null) {
      this.value = x;
      this.lastTime = timeSeconds;
      return x;
    }
    const dt = Math.max(timeSeconds - this.lastTime, 1e-3);
    this.lastTime = timeSeconds;
    const rawDerivative = (x - this.value) / dt;
    this.derivative += smoothingFactor(this.options.derivativeCutoff, dt) * (rawDerivative - this.derivative);
    const cutoff = this.options.minCutoff + this.options.beta * Math.abs(this.derivative);
    this.value += smoothingFactor(cutoff, dt) * (x - this.value);
    return this.value;
  }

  reset(): void {
    this.value = null;
    this.derivative = 0;
  }
}

export class OneEuroFilter2D {
  private readonly fx: OneEuroFilter;
  private readonly fy: OneEuroFilter;

  constructor(options: OneEuroOptions = DEFAULT_ONE_EURO) {
    this.fx = new OneEuroFilter(options);
    this.fy = new OneEuroFilter(options);
  }

  filter(p: Point2, timeSeconds: number): Point2 {
    return { x: this.fx.filter(p.x, timeSeconds), y: this.fy.filter(p.y, timeSeconds) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}
