/**
 * Calibration state: where the projected image is in the camera picture.
 * Found automatically (autoCalibration.ts); tapping the four corners on the preview
 * (top-left, top-right, bottom-right, bottom-left) remains as a manual fallback.
 */
import { atom } from 'jotai';
import { calibrationHomography, type Mat3, type Quad } from '../domain/homography';
import { laneLayout, type LaneLayout } from '../domain/lanes';
import type { Point2 } from '../domain/pose';
import { teamZones, type TeamZone } from '../domain/teamZones';
import { cameraAspectAtom, teamCountAtom } from './poseFeed';

export const CORNER_LABELS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

/** Committed calibration, in camera space. */
export const calibrationAtom = atom<Quad | null>(null);
/** Corners tapped so far during calibration. */
export const draftCornersAtom = atom<readonly Point2[]>([]);
export const calibrationErrorAtom = atom<string | null>(null);

export const homographyAtom = atom<Mat3 | null>((get) => {
  const corners = get(calibrationAtom);
  return corners ? calibrationHomography(corners) : null;
});

/** Where the model looks for each team's child (camera space), and the resizer scale for it. */
export const laneLayoutAtom = atom<LaneLayout>((get) => laneLayout(get(calibrationAtom), get(cameraAspectAtom), get(teamCountAtom)));

/**
 * The team halves to draw on the preview (camera space). Hidden while corners are being
 * tapped by hand: the old calibration is about to be replaced, and drawing its halves next
 * to the new taps would show two projections at once.
 */
export const teamZonesAtom = atom<readonly TeamZone[] | null>((get) => {
  const corners = get(calibrationAtom);
  return corners && get(draftCornersAtom).length === 0 ? teamZones(corners, get(teamCountAtom)) : null;
});

export const nextCornerLabelAtom = atom((get) => CORNER_LABELS[get(draftCornersAtom).length] ?? null);

export const addCornerAtom = atom(null, (get, set, corner: Point2) => {
  const draft = [...get(draftCornersAtom), corner];
  set(calibrationErrorAtom, null);
  if (draft.length < 4) {
    set(draftCornersAtom, draft);
    return;
  }
  const quad = draft as unknown as Quad;
  if (calibrationHomography(quad) === null) {
    set(draftCornersAtom, []);
    set(calibrationErrorAtom, 'Those corners do not form the projection. Tap them clockwise, starting at the top-left.');
    return;
  }
  set(calibrationAtom, quad);
  set(draftCornersAtom, []);
});

/** Commits a calibration found automatically (see autoCalibration.ts). */
export const commitCalibrationAtom = atom(null, (_get, set, corners: Quad) => {
  set(calibrationAtom, corners);
  set(draftCornersAtom, []);
  set(calibrationErrorAtom, null);
});

export const resetCalibrationAtom = atom(null, (_get, set) => {
  set(calibrationAtom, null);
  set(draftCornersAtom, []);
  set(calibrationErrorAtom, null);
});
