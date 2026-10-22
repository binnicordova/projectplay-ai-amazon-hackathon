/**
 * Which of the phone's back cameras films the class.
 *
 * Phones have several, and the system default is not always the best one for us:
 * - The main ("wide-angle") camera has the largest sensor and the brightest lens, so the
 *   children are less noisy and less blurred in a dark classroom: MoveNet finds more wrists.
 * - The ultra-wide bends straight lines towards the edges. Calibration maps the camera to
 *   the wall with a homography, which assumes straight lines stay straight, so hands near
 *   the edges would land beside their tiles. It is also darker (f/2.2 against f/1.8 on the A26).
 * - Android reports macro lenses as "telephoto" (narrower than the main camera): low
 *   resolution and focused a few centimetres away.
 * - A logical multi-camera switches lenses as it zooms, and every switch changes the field of
 *   view under a finished calibration.
 *
 * Measured on the Galaxy A26: main 4080×3060 f/1.8, ultra-wide 3264×2448 f/2.2, plus a
 * logical camera made of both.
 */

export type CameraKind = 'main' | 'ultra-wide' | 'telephoto' | 'multi' | 'depth' | 'other';

export interface CameraCandidate {
  readonly id: string;
  readonly kind: CameraKind;
  /** Largest picture it can take, in pixels. */
  readonly pixels: number;
  /** Lens f-number: lower lets in more light. */
  readonly aperture: number;
}

/** Best first. Depth sensors never film children. */
const KIND_RANK: Readonly<Record<CameraKind, number>> = { main: 4, multi: 3, other: 2, telephoto: 1, 'ultra-wide': 1, depth: -1 };

function better(a: CameraCandidate, b: CameraCandidate): boolean {
  if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] > KIND_RANK[b.kind];
  if (a.pixels !== b.pixels) return a.pixels > b.pixels;
  return a.aperture < b.aperture;
}

/** The back camera to track children with, or null to let the system pick. */
export function chooseTrackingCamera<T extends CameraCandidate>(backCameras: readonly T[]): T | null {
  const usable = backCameras.filter((c) => KIND_RANK[c.kind] >= 0);
  return usable.reduce<T | null>((best, c) => (best === null || better(c, best) ? c : best), null);
}

/** "main camera, 12.5 MP, f/1.8": for the device log. */
export function describeCamera(camera: CameraCandidate): string {
  const megapixels = camera.pixels > 0 ? `, ${(camera.pixels / 1e6).toFixed(1)} MP` : '';
  const aperture = camera.aperture > 0 ? `, f/${camera.aperture.toFixed(1)}` : '';
  return `${camera.kind} camera ${camera.id}${megapixels}${aperture}`;
}
