import { describe, expect, it } from 'vitest';
import { solveAutoCalibration } from './autoCalibration';
import type { Quad } from './homography';
import { FrameAverager, LUMA_BYTES, LUMA_WIDTH, decodeLuma, encodeLuma, lumaFromRgb, orderClockwise } from './markers';
import { SOURCE_BYTES, SOURCE_WIDTH } from './moveNet';
import { KEYSTONED, renderCapture, renderPattern } from './testing/syntheticProjection';

const expectCorners = (actual: Quad, expected: Quad, tolerance = 0.005) =>
  actual.forEach((p, i) => {
    expect(Math.abs(p.x - expected[i]!.x)).toBeLessThan(tolerance);
    expect(Math.abs(p.y - expected[i]!.y)).toBeLessThan(tolerance);
  });

describe('automatic calibration', () => {
  it('finds a keystoned projection to within a pixel, ignoring the lit room', () => {
    const result = solveAutoCalibration(renderCapture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectCorners(result.corners, KEYSTONED);
    expect(result.centerError).not.toBeNull();
    expect(result.centerError!).toBeLessThan(0.01);
  });

  it('works without the check pattern', () => {
    const result = solveAutoCalibration(renderCapture({}, false));
    expect(result.ok && result.centerError).toBeNull();
  });

  it('handles a projection that fills most of the camera view', () => {
    const big: Quad = [
      { x: 0.04, y: 0.05 },
      { x: 0.97, y: 0.03 },
      { x: 0.95, y: 0.93 },
      { x: 0.06, y: 0.95 },
    ];
    const result = solveAutoCalibration(renderCapture({ projection: big }));
    expect(result.ok).toBe(true);
    if (result.ok) expectCorners(result.corners, big);
  });

  it('asks to clear the corners when a marker is hidden', () => {
    const result = solveAutoCalibration(renderCapture({ blocked: (p) => p.x > 0.75 && p.y > 0.7 }));
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.reason).toMatch(/3 of 4/);
  });

  it('refuses when something else changes during the capture', () => {
    const result = solveAutoCalibration(renderCapture({ intruder: { pattern: 'corners', x: 0.5, y: 0.85, radius: 0.04 } }));
    expect(!result.ok && result.reason).toMatch(/stand still/);
  });

  it('explains when the camera cannot see the projection at all', () => {
    const result = solveAutoCalibration(renderCapture({ markerLevel: 30 }));
    expect(!result.ok && result.reason).toMatch(/cannot see/);
  });

  it('rejects a result the check marker disagrees with (the phone moved)', () => {
    const capture = renderCapture();
    const moved: Quad = KEYSTONED.map((p) => ({ x: p.x + 0.05, y: p.y })) as unknown as Quad;
    const result = solveAutoCalibration({ ...capture, center: renderPattern('center', { projection: moved, seed: 9 }) });
    expect(!result.ok && result.reason).toMatch(/off target/);
  });
});

describe('marker helpers', () => {
  it('orders corners clockwise from the top-left whatever order they were found in', () => {
    const shuffled = [KEYSTONED[2], KEYSTONED[0], KEYSTONED[3], KEYSTONED[1]];
    expect(orderClockwise(shuffled)).toEqual([...KEYSTONED]);
  });

  it('averages frames', () => {
    const averager = new FrameAverager();
    averager.add(new Uint8Array([10, 20]));
    averager.add(new Uint8Array([30, 40]));
    expect(averager.count).toBe(2);
    expect(Array.from(averager.mean())).toEqual([20, 30]);
  });

  it('packs luma frames into a string and back without loss', () => {
    const luma = Uint8Array.from({ length: 5000 }, (_, i) => (i * 37) % 256);
    const text = encodeLuma(luma);
    expect(text).toHaveLength(5000);
    expect(text.includes('\0')).toBe(false);
    expect(decodeLuma(text)).toEqual(luma);
  });

  it('subsamples the RGB resizer buffer into greyscale', () => {
    const rgb = new Uint8Array(SOURCE_BYTES);
    // Pixel (3, 3) of the source becomes luma pixel (1, 1).
    rgb.set([40, 80, 120], (3 * SOURCE_WIDTH + 3) * 3);
    const luma = new Uint8Array(LUMA_BYTES);
    lumaFromRgb(rgb, luma);
    expect(luma[LUMA_WIDTH + 1]).toBe((40 + 160 + 120) >> 2);
    expect(luma[0]).toBe(0);
  });
});
