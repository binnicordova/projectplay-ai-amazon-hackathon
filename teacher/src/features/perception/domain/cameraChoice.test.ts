import { describe, expect, it } from 'vitest';
import { chooseTrackingCamera, describeCamera, type CameraCandidate } from './cameraChoice';

// The Galaxy A26's back cameras, as Android lists them.
const main: CameraCandidate = { id: '0', kind: 'main', pixels: 4080 * 3060, aperture: 1.8 };
const ultraWide: CameraCandidate = { id: '2', kind: 'ultra-wide', pixels: 3264 * 2448, aperture: 2.2 };
const logical: CameraCandidate = { id: '3', kind: 'multi', pixels: 4080 * 3060, aperture: 1.8 };
const macro: CameraCandidate = { id: '4', kind: 'telephoto', pixels: 1600 * 1200, aperture: 2.4 };
const depth: CameraCandidate = { id: '5', kind: 'depth', pixels: 640 * 480, aperture: 0 };

describe('tracking camera choice', () => {
  it('picks the main camera over the ultra-wide, a macro and a lens-switching logical camera', () => {
    expect(chooseTrackingCamera([ultraWide, logical, macro, main])).toBe(main);
  });

  it('prefers the sharper, then the brighter main camera when a phone has two', () => {
    const small = { ...main, id: '7', pixels: 8e6 };
    const dim = { ...main, id: '8', aperture: 2.0 };
    expect(chooseTrackingCamera([small, dim, main])).toBe(main);
  });

  it('falls back to the logical camera, then anything but a depth sensor', () => {
    expect(chooseTrackingCamera([ultraWide, logical])).toBe(logical);
    expect(chooseTrackingCamera([depth, ultraWide])).toBe(ultraWide);
    expect(chooseTrackingCamera([depth])).toBeNull();
    expect(chooseTrackingCamera([])).toBeNull();
  });

  it('describes the choice for the device log', () => {
    expect(describeCamera(main)).toBe('main camera 0, 12.5 MP, f/1.8');
  });
});
