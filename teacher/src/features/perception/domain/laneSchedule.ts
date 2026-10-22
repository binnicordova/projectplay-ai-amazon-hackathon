/**
 * Which lane MoveNet looks at on each camera frame.
 *
 * The model is most of the camera thread's time (~60 ms per lane on a warm Galaxy A26), and
 * running both lanes on every frame made every pose wait for the other lane too: a hand
 * reached the TV ~130 ms after the picture was taken. One lane per frame halves that wait.
 *
 * Lanes with a child take turns; a lane without one is only looked at on every
 * PROBE_EVERY-th frame, so a single child gets most frames (and the phone stays cooler),
 * while a child stepping into an empty lane is still found within a few tenths of a second.
 *
 * Runs inside the camera worklet: plain numbers in and out, no allocations.
 */
import { LANE_COUNT } from './moveNet';

/** An empty lane gets one frame in this many while another lane has a child. */
export const PROBE_EVERY = 4;

/** Bit `i` set = lane `i` has (or may have) a child in it. */
export type BusyLanes = number;

export const busyLanesOf = (busy: readonly boolean[]): BusyLanes => busy.reduce((mask, b, i) => (b ? mask | (1 << i) : mask), 0);

const isBusy = (mask: BusyLanes, lane: number): boolean => {
  'worklet';
  return ((mask >> lane) & 1) === 1;
};

/** The `n`-th lane (0-based) whose busy bit equals `busy`. */
function nthLane(mask: BusyLanes, busy: boolean, n: number, laneCount: number): number {
  'worklet';
  let seen = 0;
  for (let lane = 0; lane < laneCount; lane++) {
    if (isBusy(mask, lane) !== busy) continue;
    if (seen === n) return lane;
    seen++;
  }
  return 0;
}

/**
 * @param turn  frame counter (increments once per frame the model runs on)
 * @param mask  lanes that have a child (see BusyLanes)
 */
export function laneForTurn(turn: number, mask: BusyLanes, laneCount: number = LANE_COUNT): number {
  'worklet';
  let busyCount = 0;
  for (let lane = 0; lane < laneCount; lane++) if (isBusy(mask, lane)) busyCount++;
  // Nobody, or everybody: plain round robin.
  if (busyCount === 0 || busyCount === laneCount) return turn % laneCount;
  const probe = turn % PROBE_EVERY === PROBE_EVERY - 1;
  if (probe) return nthLane(mask, false, Math.floor(turn / PROBE_EVERY) % (laneCount - busyCount), laneCount);
  return nthLane(mask, true, turn % busyCount, laneCount);
}
