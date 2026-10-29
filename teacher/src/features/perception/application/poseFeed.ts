/**
 * What perception decided on the latest frame (skeleton overlay) and how fast it runs (status).
 * Written at camera rate by the composition root; read by small overlays only.
 */
import { DEFAULT_TEAM_COUNT, type TeamCount } from '@mimikai/contracts';
import { atom } from 'jotai';
import { SLOW_FPS, type FrameRate } from '../domain/frameRate';
import type { BusyLanes } from '../domain/laneSchedule';
import type { PerceptionView } from './perceptionPipeline';

export type CameraStatus =
  | { readonly state: 'starting' }
  | { readonly state: 'needs-permission' }
  | { readonly state: 'running' }
  | { readonly state: 'error'; readonly message: string };

export const perceptionViewAtom = atom<PerceptionView | null>(null);
export const frameRateAtom = atom<FrameRate | null>(null);
/**
 * Whole frames per second while tracking is too slow, else null. Narrow on purpose: the
 * status line re-renders only when this number changes, not on every frame.
 */
export const slowTrackingFpsAtom = atom((get) => {
  const rate = get(frameRateAtom);
  return rate && rate.fps < SLOW_FPS ? Math.round(rate.fps) : null;
});
export const cameraStatusAtom = atom<CameraStatus>({ state: 'starting' });
/**
 * Lanes with a child in them, so the camera gives them most of the frames. Written only when
 * it changes (a child steps in or out): the camera worklet is reinstalled on every change.
 */
export const busyLanesAtom = atom<BusyLanes>(0);
/**
 * Teams on the wall, so camera lanes: one per team half, or a single lane over the whole wall
 * for one player. Written by the composition root (the teacher's choice, or the session the TV
 * is running); the lane crops and the camera worklet are rebuilt when it changes.
 */
export const teamCountAtom = atom<TeamCount>(DEFAULT_TEAM_COUNT);
/**
 * Camera aspect ratio (width / height). Written only when it actually changes, because lane
 * crops and the camera worklet depend on it and must not be rebuilt at frame rate.
 */
export const cameraAspectAtom = atom<number>(4 / 3);

/** Camera brightness (exposure bias steps): dark classrooms need a boost to see children. */
export type CameraBrightness = 0 | 1 | 2;
export const cameraBrightnessAtom = atom<CameraBrightness>(1);
