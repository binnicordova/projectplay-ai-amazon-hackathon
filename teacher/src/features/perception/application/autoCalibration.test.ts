import type { CalibrationPattern, TeacherMessage } from '@mimikai/contracts';
import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LUMA_HEIGHT, LUMA_WIDTH } from '../domain/markers';
import { KEYSTONED, renderPattern } from '../domain/testing/syntheticProjection';
import { AutoCalibrator, autoCalibrationAtom, lumaCaptureAtom } from './autoCalibration';
import { calibrationAtom } from './calibration';

const frameOf = (pattern: CalibrationPattern, seed: number) => ({
  luma: Uint8Array.from(renderPattern(pattern, { seed }), (v) => Math.round(v)),
  width: LUMA_WIDTH,
  height: LUMA_HEIGHT,
});

function setup(connected = true) {
  const store = createStore();
  const sent: TeacherMessage[] = [];
  const calibrator = new AutoCalibrator({ store, send: (m) => sent.push(m), isTvConnected: () => connected });
  const shown = () => sent.filter((m): m is Extract<TeacherMessage, { t: 'calib' }> => m.t === 'calib').map((m) => m.show);
  /** The camera films what is on the wall for `ms`, at ~30 fps. */
  const film = (scene: CalibrationPattern, ms: number) => {
    for (let t = 0; t < ms; t += 33) {
      vi.advanceTimersByTime(33);
      calibrator.onLumaFrame(frameOf(scene, t));
    }
  };
  return { store, calibrator, shown, film };
}

describe('AutoCalibrator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows corners then dark, and commits the projection it found', () => {
    const { store, calibrator, shown, film } = setup();
    calibrator.start();
    expect(store.get(lumaCaptureAtom)).toBe(true);
    calibrator.onPatternShown('corners');
    film('corners', 1200);
    expect(shown()).toEqual(['corners', 'dark']);
    calibrator.onPatternShown('dark');
    film('dark', 700);
    expect(shown()).toEqual(['corners', 'dark', null]);
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'done' });
    expect(store.get(lumaCaptureAtom)).toBe(false);
    store.get(calibrationAtom)!.forEach((p, i) => expect(Math.hypot(p.x - KEYSTONED[i]!.x, p.y - KEYSTONED[i]!.y)).toBeLessThan(0.006));
  });

  it('still calibrates when the TV never confirms (fixed waits instead)', () => {
    const { store, calibrator, shown, film } = setup();
    calibrator.start();
    film('corners', 2000);
    expect(shown()).toEqual(['corners', 'dark']);
    film('dark', 1200);
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'done' });
  });

  it('ignores frames filmed before the pattern can be on the wall', () => {
    const { calibrator, shown, film } = setup();
    calibrator.start();
    film('dark', 1500); // the TV is slow: the wall is still dark
    expect(shown()).toEqual(['corners']);
  });

  it('reports live progress: TV confirmation and frames received', () => {
    const { store, calibrator, film } = setup();
    calibrator.start();
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'running', tvConfirmed: false, frames: 0 });
    calibrator.onPatternShown('corners');
    film('corners', 400);
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'running', tvConfirmed: true });
    expect((store.get(autoCalibrationAtom) as { frames: number }).frames).toBeGreaterThan(5);
  });

  it('retries once, then explains that no camera pictures arrived', () => {
    const { store, calibrator, shown } = setup();
    calibrator.start();
    vi.advanceTimersByTime(6000);
    expect(shown()).toEqual(['corners', null, 'corners']);
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'running' });
    vi.advanceTimersByTime(6000);
    expect(shown()).toEqual(['corners', null, 'corners', null]);
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'failed', reason: expect.stringMatching(/not sending pictures/) });
  });

  it('needs a connected TV', () => {
    const { store, calibrator, shown } = setup(false);
    calibrator.start();
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'failed' });
    expect(shown()).toEqual([]);
  });

  it('stays stopped after Cancel instead of restarting by itself', () => {
    const { store, calibrator, shown } = setup();
    calibrator.start();
    calibrator.cancel();
    expect(store.get(autoCalibrationAtom)).toMatchObject({ state: 'failed', reason: expect.stringMatching(/cancelled/) });
    expect(shown()).toEqual(['corners', null]);
  });
});
