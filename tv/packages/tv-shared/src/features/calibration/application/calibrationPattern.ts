/**
 * Calibration pattern requested by the phone (see @mimikai/contracts calibration.ts).
 * A new object per request, so a repeated request is shown — and confirmed — again.
 */
import type { CalibrationPattern } from '@mimikai/contracts';
import { atom } from 'jotai';

export interface PatternRequest {
  readonly pattern: CalibrationPattern;
}

export const calibrationPatternAtom = atom<PatternRequest | null>(null);

/** Never leave the class on a black screen: hide the pattern if the phone goes quiet. */
export const PATTERN_TIMEOUT_MS = 8000;
