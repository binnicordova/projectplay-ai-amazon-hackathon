/**
 * Receives children's hand positions (≈15 Hz per hand) and turns them into
 * hover / dwell / select events against the targets of the board on screen.
 *
 * Every hand is its own pointer: `pointerId = player * 2 + hand`. Fast data never goes
 * through React state: cursors and tiles subscribe here and drive Animated values.
 */
import {
  DEFAULT_TEAM_COUNT,
  teamForPlayer,
  type HandId,
  type NormalizedPoint,
  type PlayerId,
  type TeamCount,
  type TeamId,
} from '@projectplay/contracts';
import { DEFAULT_DWELL, DwellTracker, type DwellOptions } from '../domain/dwell';
import type { BoardTarget } from '../domain/layout';

export interface PointerSample {
  readonly pointerId: number;
  readonly team: TeamId;
  /** null = this hand disappeared. */
  readonly point: NormalizedPoint | null;
}

export const pointerIdOf = (player: PlayerId, hand: HandId): number => player * 2 + hand;
const HANDS: readonly HandId[] = [0, 1];

/** A pointer is considered gone if not updated for this long. */
export const POINTER_STALE_MS = 800;

interface Fill {
  readonly targetId: string;
  readonly progress: number;
}

export class PointerHub {
  private readonly dwell: DwellTracker;
  private targets: readonly BoardTarget[] = [];
  private readonly listeners = new Set<(sample: PointerSample) => void>();
  private readonly progressListeners = new Set<(targetId: string, progress: number) => void>();
  private readonly selectListeners = new Set<(team: TeamId, target: BoardTarget) => void>();
  private readonly lastSeen = new Map<number, { readonly team: TeamId; readonly at: number }>();
  /** Progress per pointer, and the per-target maximum last shown on screen. */
  private readonly fills = new Map<number, Fill>();
  private readonly shown = new Map<string, number>();
  private teamCount: TeamCount = DEFAULT_TEAM_COUNT;

  constructor(
    private readonly now: () => number = () => Date.now(),
    readonly options: DwellOptions = DEFAULT_DWELL,
  ) {
    this.dwell = new DwellTracker(options);
  }

  setDwellMs(dwellMs: number): void {
    this.dwell.setDwellMs(dwellMs);
  }

  setTargets(targets: readonly BoardTarget[]): void {
    this.targets = targets;
    this.dwell.setTargets(targets);
    this.fills.clear();
    const filled = [...this.shown.keys()];
    this.shown.clear();
    filled.forEach((id) => this.progressListeners.forEach((l) => l(id, 0)));
  }

  /**
   * With one player every hand is on team A, wherever the phone saw it. Switching drops the
   * hands already tracked: each comes back on its next sample, on its new team (and colour).
   */
  setTeamCount(count: TeamCount): void {
    if (count === this.teamCount) return;
    this.teamCount = count;
    [...this.lastSeen.entries()].forEach(([pointerId, { team }]) => this.drop(pointerId, team));
  }

  /** Cursor positions, per hand. */
  subscribe(listener: (sample: PointerSample) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Selection progress (0..1) per target, whenever it changes. */
  subscribeProgress(listener: (targetId: string, progress: number) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  onSelect(listener: (team: TeamId, target: BoardTarget) => void): () => void {
    this.selectListeners.add(listener);
    return () => this.selectListeners.delete(listener);
  }

  move(player: PlayerId, hand: HandId, point: NormalizedPoint): void {
    const now = this.now();
    const pointerId = pointerIdOf(player, hand);
    const team = this.teamOf(player);
    this.lastSeen.set(pointerId, { team, at: now });
    this.listeners.forEach((l) => l({ pointerId, team, point }));

    const update = this.dwell.update(pointerId, team, point, now);
    const before = this.fills.get(pointerId)?.targetId ?? null;
    if (update.targetId) this.fills.set(pointerId, { targetId: update.targetId, progress: update.progress });
    else this.fills.delete(pointerId);
    this.refresh(before);
    if (update.targetId !== before) this.refresh(update.targetId);
    if (update.selectedId) this.emitSelect(team, update.selectedId);
  }

  /** Keeps a pointer that is resting on purpose (the TV-remote cursor) from going stale. */
  keepAlive(player: PlayerId, hand: HandId): void {
    const pointerId = pointerIdOf(player, hand);
    const seen = this.lastSeen.get(pointerId);
    if (seen) this.lastSeen.set(pointerId, { team: seen.team, at: this.now() });
  }

  /** Both hands of a child are gone (left the camera view). */
  lost(player: PlayerId): void {
    HANDS.forEach((hand) => this.drop(pointerIdOf(player, hand), this.teamOf(player)));
  }

  /** Immediate selection (remote-control "OK" on the virtual pointer). */
  selectAt(player: PlayerId, point: NormalizedPoint): void {
    const team = this.teamOf(player);
    const target = this.dwell.targetAt(team, point);
    if (target) this.emitSelect(team, target.id);
  }

  /** Drops hands that stopped updating (hand lowered, child walked away, phone disconnected). */
  sweep(): void {
    const now = this.now();
    this.lastSeen.forEach(({ team, at }, pointerId) => {
      if (now - at > POINTER_STALE_MS) this.drop(pointerId, team);
    });
  }

  teamOf(player: PlayerId): TeamId {
    return teamForPlayer(player, this.teamCount);
  }

  private drop(pointerId: number, team: TeamId): void {
    if (!this.lastSeen.delete(pointerId)) return;
    this.dwell.release(pointerId);
    const before = this.fills.get(pointerId)?.targetId ?? null;
    this.fills.delete(pointerId);
    this.refresh(before);
    this.listeners.forEach((l) => l({ pointerId, team, point: null }));
  }

  private refresh(targetId: string | null): void {
    if (targetId === null) return;
    let progress = 0;
    this.fills.forEach((fill) => {
      if (fill.targetId === targetId && fill.progress > progress) progress = fill.progress;
    });
    if ((this.shown.get(targetId) ?? 0) === progress) return;
    if (progress === 0) this.shown.delete(targetId);
    else this.shown.set(targetId, progress);
    this.progressListeners.forEach((l) => l(targetId, progress));
  }

  private emitSelect(team: TeamId, targetId: string): void {
    const target = this.targets.find((t) => t.id === targetId);
    if (target) this.selectListeners.forEach((l) => l(team, target));
  }
}
