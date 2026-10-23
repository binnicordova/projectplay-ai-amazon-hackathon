/**
 * "Hover and hold" selection: a single camera cannot tell touching the wall from
 * hovering in front of it, so a target is selected when a child's hand stays on it.
 *
 * Progress is *leaky*, not a stopwatch: it fills while the hand is on the target and
 * drains (slower) while it is off. Pose tracking from behind is noisy, so a hand that
 * wobbles over a tile edge, or drops out for a frame, keeps most of its progress instead
 * of starting over. Time between samples is capped, so a gap in tracking never counts as
 * "holding"; progress simply freezes until the hand is seen again (or goes stale).
 *
 * Each hand of each child is its own pointer (`pointerId`), so either hand can answer.
 *
 * A selection is not final: children may change their minds until the time is up. So once a
 * tile is selected the hold starts over at zero (and stays there while the hand rests on the
 * same tile), and holding on another tile takes the usual dwell instead of first draining a
 * full bar.
 */
import type { NormalizedPoint, TeamId } from '@projectplay/contracts';

export interface NormalizedRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Target {
  readonly id: string;
  readonly rect: NormalizedRect;
  /** Only this team's children can select it (null = anyone). */
  readonly team: TeamId | null;
}

export interface DwellOptions {
  /** Time on a target needed to select it. */
  readonly dwellMs: number;
  /** Time off target to drain a full progress bar (longer = more forgiving). */
  readonly drainMs: number;
  /** Extra margin around each target, in projection units. */
  readonly hitSlop: number;
  /**
   * Longest gap between two samples that still counts as continuous movement. A warm phone
   * delivers 4–10 frames per second (100–250 ms apart) and each one must count in full, or a
   * hold takes twice as long; a hand lost from tracking is gone for longer than that.
   */
  readonly maxStepMs: number;
}

export const DEFAULT_DWELL: DwellOptions = { dwellMs: 600, drainMs: 900, hitSlop: 0.025, maxStepMs: 250 };

export interface DwellUpdate {
  /** Target this pointer is filling (null = none). */
  readonly targetId: string | null;
  /** 0..1 */
  readonly progress: number;
  /** Set once, on the update where progress reaches 1 (progress then starts over at 0). */
  readonly selectedId: string | null;
}

interface PointerState {
  targetId: string | null;
  progress: number;
  last: number;
  fired: boolean;
}

export const contains = (rect: NormalizedRect, p: NormalizedPoint, slop = 0): boolean =>
  p.x >= rect.x - slop && p.x <= rect.x + rect.width + slop && p.y >= rect.y - slop && p.y <= rect.y + rect.height + slop;

const IDLE: DwellUpdate = { targetId: null, progress: 0, selectedId: null };

export class DwellTracker {
  private targets: readonly Target[] = [];
  private readonly pointers = new Map<number, PointerState>();

  constructor(private options: DwellOptions = DEFAULT_DWELL) {}

  /** Hold time per age group: younger children get a little longer (their arms waver more). */
  setDwellMs(dwellMs: number): void {
    this.options = { ...this.options, dwellMs };
  }

  setTargets(targets: readonly Target[]): void {
    this.targets = targets;
    this.pointers.clear();
  }

  targetAt(team: TeamId, point: NormalizedPoint): Target | null {
    const { hitSlop } = this.options;
    const hits = this.targets.filter((t) => (t.team === null || t.team === team) && contains(t.rect, point, hitSlop));
    if (hits.length < 2) return hits[0] ?? null;
    // Inside two slop margins at once: the closest centre wins.
    const distance = (t: Target) => Math.hypot(t.rect.x + t.rect.width / 2 - point.x, t.rect.y + t.rect.height / 2 - point.y);
    return hits.reduce((best, t) => (distance(t) < distance(best) ? t : best));
  }

  update(pointerId: number, team: TeamId, point: NormalizedPoint, now: number): DwellUpdate {
    const { dwellMs, drainMs, maxStepMs } = this.options;
    let state = this.pointers.get(pointerId);
    if (!state) {
      state = { targetId: null, progress: 0, last: now, fired: false };
      this.pointers.set(pointerId, state);
    }
    const dt = Math.max(0, Math.min(maxStepMs, now - state.last));
    state.last = now;
    const target = this.targetAt(team, point);

    if (target && target.id === state.targetId && state.fired) {
      // Resting on the tile it just selected: nothing more to fill.
      state.progress = 0;
    } else if (target && (target.id === state.targetId || state.progress === 0)) {
      if (target.id !== state.targetId) {
        state.targetId = target.id;
        state.fired = false;
      }
      state.progress = Math.min(1, state.progress + dt / dwellMs);
    } else {
      // Off target, or on a different one: drain first, then switch on a later sample.
      state.progress = Math.max(0, state.progress - dt / drainMs);
      if (state.progress === 0) {
        state.targetId = target?.id ?? null;
        state.fired = false;
      }
    }

    if (state.targetId === null) return IDLE;
    const selectedId = state.progress >= 1 && !state.fired ? state.targetId : null;
    if (selectedId) {
      state.fired = true;
      state.progress = 0;
    }
    return { targetId: state.targetId, progress: state.progress, selectedId };
  }

  release(pointerId: number): void {
    this.pointers.delete(pointerId);
  }
}
