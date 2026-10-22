/**
 * Automatic calibration use case: the TV shows markers, the camera films them, the
 * projection corners are solved and committed. Takes about three seconds.
 *
 *   for each pattern (corners → dark):
 *     ask the TV to show it → wait until it is surely on the wall → average a few frames
 *   hide the pattern → solve → commit the calibration (or retry once, then explain)
 *
 * Built to keep going when one part is slow or silent:
 * - The TV's "shown" confirmation only *shortens* the wait. Without it, a fixed wait
 *   (long enough for the TV, the projector and the camera's exposure) is used instead.
 * - The status reports what is happening (TV confirmed? frames received?), so a stuck
 *   step says why on screen and in the log.
 */
import type { CalibrationPattern, TeacherMessage } from '@projectplay/contracts';
import { atom, type createStore } from 'jotai';
import { solveAutoCalibration } from '../domain/autoCalibration';
import { FrameAverager } from '../domain/markers';
import { commitCalibrationAtom } from './calibration';

type Store = ReturnType<typeof createStore>;

export interface LumaFrame {
  readonly luma: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export type AutoCalibrationStatus =
  | { readonly state: 'idle' }
  | {
      readonly state: 'running';
      readonly step: number;
      readonly steps: number;
      /** The TV confirmed the current pattern is on screen. */
      readonly tvConfirmed: boolean;
      /** Camera frames received since the calibration started. */
      readonly frames: number;
    }
  | { readonly state: 'done'; readonly centerError: number | null }
  | { readonly state: 'failed'; readonly reason: string };

export const autoCalibrationAtom = atom<AutoCalibrationStatus>({ state: 'idle' });
/** While true the camera sends greyscale frames instead of running the pose model. */
export const lumaCaptureAtom = atom((get) => get(autoCalibrationAtom).state === 'running');
/** Changes only when the state does, so screens can react without re-rendering per frame. */
export const autoCalibrationStateAtom = atom((get) => get(autoCalibrationAtom).state);

interface Step {
  readonly pattern: CalibrationPattern;
  /** Wait after asking the TV when it does not confirm (TV + projector + camera exposure). */
  readonly waitMs: number;
  /** Wait after the TV confirmed: just the projector and the camera's exposure. */
  readonly settleMs: number;
}

export const CALIBRATION_STEPS: readonly Step[] = [
  // The first pattern waits longest: the camera's exposure adapts from the bright game screen.
  { pattern: 'corners', waitMs: 1800, settleMs: 1000 },
  { pattern: 'dark', waitMs: 1000, settleMs: 450 },
];

export interface AutoCalibrationOptions {
  readonly framesPerStep: number;
  /** After the wait, the camera must deliver the frames within this time. */
  readonly captureTimeoutMs: number;
  /** Automatic new attempts before reporting a failure. */
  readonly retries: number;
}

export const DEFAULT_AUTO_CALIBRATION: AutoCalibrationOptions = { framesPerStep: 3, captureTimeoutMs: 4000, retries: 1 };

export interface AutoCalibratorDeps {
  readonly store: Store;
  readonly send: (message: TeacherMessage) => void;
  readonly isTvConnected: () => boolean;
  readonly now?: () => number;
  readonly options?: AutoCalibrationOptions;
}

interface Run {
  step: number;
  readyAt: number;
  tvConfirmed: boolean;
  frames: number;
  averager: FrameAverager;
  readonly captures: Partial<Record<CalibrationPattern, Float32Array>>;
}

/** Frame counts are shown live, but the status is not rewritten more often than this. */
const STATUS_INTERVAL_MS = 250;

export class AutoCalibrator {
  private run: Run | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastStatusAt = 0;
  private readonly now: () => number;
  private readonly options: AutoCalibrationOptions;

  constructor(private readonly deps: AutoCalibratorDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.options = deps.options ?? DEFAULT_AUTO_CALIBRATION;
  }

  get isRunning(): boolean {
    return this.run !== null;
  }

  start(): void {
    if (this.run) return;
    this.attempt = 0;
    this.begin();
  }

  /** Stops for good (until "Try again"): an idle state would restart automatically. */
  cancel(reason = 'Calibration cancelled. Tap "Try again", or tap the four corners of the projection yourself.'): void {
    if (!this.run) return;
    this.stop();
    this.setStatus({ state: 'failed', reason });
  }

  /** The TV confirmed a pattern is on screen: no need to wait the full time. */
  onPatternShown(shown: CalibrationPattern | null): void {
    const run = this.run;
    const step = run ? CALIBRATION_STEPS[run.step]! : null;
    if (!run || !step || run.tvConfirmed || shown !== step.pattern) return;
    run.tvConfirmed = true;
    run.readyAt = Math.min(run.readyAt, this.now() + step.settleMs);
    this.publish(run, true);
  }

  onLumaFrame(frame: LumaFrame): void {
    const run = this.run;
    if (!run) return;
    run.frames++;
    this.publish(run);
    if (this.now() < run.readyAt) return;
    run.averager.add(frame.luma);
    if (run.averager.count < this.options.framesPerStep) return;

    run.captures[CALIBRATION_STEPS[run.step]!.pattern] = run.averager.mean();
    if (run.step + 1 < CALIBRATION_STEPS.length) this.show(run.step + 1);
    else this.finish(run, frame);
  }

  private begin(): void {
    if (!this.deps.isTvConnected()) {
      this.setStatus({ state: 'failed', reason: 'Connect the TV first: it shows the markers the camera looks for.' });
      return;
    }
    this.run = { step: 0, readyAt: 0, tvConfirmed: false, frames: 0, averager: new FrameAverager(), captures: {} };
    this.show(0);
  }

  private show(index: number): void {
    const run = this.run!;
    const step = CALIBRATION_STEPS[index]!;
    run.step = index;
    run.readyAt = this.now() + step.waitMs;
    run.tvConfirmed = false;
    run.averager = new FrameAverager();
    this.deps.send({ t: 'calib', show: step.pattern });
    this.publish(run, true);
    this.arm(step.waitMs + this.options.captureTimeoutMs, () =>
      run.frames === 0
        ? 'The camera is not sending pictures to the calibration. Go back and open this screen again.'
        : `The camera only sent ${run.frames} pictures in time. Close other camera apps and try again.`,
    );
  }

  private finish(run: Run, frame: LumaFrame): void {
    this.stop();
    const { corners, dark, center } = run.captures;
    const result = solveAutoCalibration({ width: frame.width, height: frame.height, corners: corners!, dark: dark!, center: center ?? null });
    if (!result.ok) {
      this.retryOrFail(result.reason);
      return;
    }
    this.deps.store.set(commitCalibrationAtom, result.corners);
    this.setStatus({ state: 'done', centerError: result.centerError });
  }

  private retryOrFail(reason: string): void {
    this.stop();
    if (this.attempt < this.options.retries && this.deps.isTvConnected()) {
      this.attempt++;
      console.log(`[calib] retrying after: ${reason}`);
      this.begin();
      return;
    }
    this.setStatus({ state: 'failed', reason });
  }

  /** Hides the pattern on the TV and forgets the run. */
  private stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.run) return;
    this.run = null;
    this.deps.send({ t: 'calib', show: null });
  }

  private arm(ms: number, reason: () => string): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.retryOrFail(reason()), ms);
  }

  private publish(run: Run, force = false): void {
    const now = this.now();
    if (!force && now - this.lastStatusAt < STATUS_INTERVAL_MS) return;
    this.lastStatusAt = now;
    this.setStatus({ state: 'running', step: run.step, steps: CALIBRATION_STEPS.length, tvConfirmed: run.tvConfirmed, frames: run.frames });
  }

  private setStatus(status: AutoCalibrationStatus): void {
    this.deps.store.set(autoCalibrationAtom, status);
  }
}
