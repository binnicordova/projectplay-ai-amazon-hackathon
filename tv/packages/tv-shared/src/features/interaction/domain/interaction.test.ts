import { describe, expect, it } from 'vitest';
import { PointerHub } from '../application/pointerHub';
import { DwellTracker, contains } from './dwell';
import type { Visual } from '@mimikai/contracts';
import { TEAM_AREA, WHOLE_WALL, choiceTargets, truthTargets } from './layout';

const numbers = (...values: number[]): Visual[] => values.map((v) => ({ kind: 'text', text: String(v) }));

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('board layout', () => {
  it('places four non-overlapping tiles per team inside its half of the wall', () => {
    const targets = choiceTargets(numbers(3, 7, 9, 12), ['A', 'B']);
    expect(targets).toHaveLength(8);
    for (const t of targets) {
      const area = TEAM_AREA[t.team];
      expect(t.rect.x).toBeGreaterThanOrEqual(area.x - 1e-9);
      expect(t.rect.x + t.rect.width).toBeLessThanOrEqual(area.x + area.width + 1e-9);
      expect(t.rect.y + t.rect.height).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < targets.length; i++)
      for (let j = i + 1; j < targets.length; j++) expect(overlaps(targets[i]!.rect, targets[j]!.rect)).toBe(false);
  });

  it('gives each team a TRUE and a FALSE tile', () => {
    expect(truthTargets(['A', 'B']).map((t) => t.label)).toEqual(['VERDADERO', 'FALSO', 'VERDADERO', 'FALSO']);
  });

  it('gives one player four full-height tiles in a row across the whole wall', () => {
    const targets = choiceTargets(numbers(3, 7, 9, 12), ['A']);
    expect(targets.map((t) => t.team)).toEqual(['A', 'A', 'A', 'A']);
    expect(targets.map((t) => t.label)).toEqual(['3', '7', '9', '12']);
    for (const t of targets) {
      expect(t.rect.y).toBeCloseTo(WHOLE_WALL.y);
      expect(t.rect.height).toBeCloseTo(WHOLE_WALL.height);
    }
    expect(targets[0]!.rect.x).toBeCloseTo(TEAM_AREA.A.x);
    expect(targets[3]!.rect.x + targets[3]!.rect.width).toBeCloseTo(TEAM_AREA.B.x + TEAM_AREA.B.width);
    for (let i = 1; i < targets.length; i++) expect(targets[i]!.rect.x).toBeGreaterThan(targets[i - 1]!.rect.x + targets[i - 1]!.rect.width);
    // Not smaller to hit than a team's 2 × 2 tile.
    const teamTile = choiceTargets(numbers(3, 7, 9, 12), ['A', 'B'])[0]!.rect;
    expect(targets[0]!.rect.width).toBeGreaterThanOrEqual(teamTile.width);
  });

  it('gives one player TRUE on the left half of the wall and FALSE on the right', () => {
    const [yes, no] = truthTargets(['A']);
    expect([yes!.label, no!.label]).toEqual(['VERDADERO', 'FALSO']);
    expect(yes!.rect.x + yes!.rect.width).toBeLessThan(0.5);
    expect(no!.rect.x).toBeGreaterThan(0.5);
  });
});

describe('dwell selection', () => {
  const targets = choiceTargets(numbers(1, 2, 3, 4), ['A', 'B']);
  const centre = (id: string) => {
    const r = targets.find((t) => t.id === id)!.rect;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const OFF = { x: 0.5, y: 0.05 };
  /** Feeds samples every `step` ms from `from` to `to` (inclusive) and returns the last update. */
  const hold = (dwell: DwellTracker, id: number, point: { x: number; y: number }, from: number, to: number, step = 66) => {
    let last = dwell.update(id, id < 4 ? 'A' : 'B', point, from);
    for (let t = from + step; t <= to; t += step) last = dwell.update(id, id < 4 ? 'A' : 'B', point, t);
    return last;
  };

  it('selects a tile after holding on it for ~0.6 s, once', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    expect(hold(dwell, 2, centre('A:option:1'), 0, 330).progress).toBeCloseTo(0.55, 1);
    const selections: (string | null)[] = [];
    for (let t = 396; t <= 900; t += 66) selections.push(dwell.update(2, 'A', centre('A:option:1'), t).selectedId);
    expect(selections.filter((s) => s !== null)).toEqual(['A:option:1']);
  });

  it('keeps most of the progress when the hand wobbles off the edge', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    hold(dwell, 2, centre('A:option:2'), 0, 264);
    const slipped = hold(dwell, 2, OFF, 330, 462);
    expect(slipped.targetId).toBe('A:option:2');
    expect(slipped.progress).toBeGreaterThan(0.2);
    // Back on the tile: it finishes sooner than a fresh 600 ms hold.
    let selectedAt = -1;
    for (let t = 528; t <= 1200 && selectedAt < 0; t += 66) if (dwell.update(2, 'A', centre('A:option:2'), t).selectedId) selectedAt = t;
    expect(selectedAt - 528).toBeLessThan(600);
  });

  it('drains back to nothing after a real exit', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    hold(dwell, 4, centre('B:option:3'), 0, 330);
    expect(hold(dwell, 4, OFF, 396, 1500).targetId).toBeNull();
  });

  it('does not count a tracking gap as holding', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    dwell.update(2, 'A', centre('A:option:1'), 0);
    // Next sample 2 s later (hand lost in between): only one capped step counts.
    expect(dwell.update(2, 'A', centre('A:option:1'), 2000).progress).toBeCloseTo(250 / 600);
  });

  it('selects in ~0.6 s even when the phone only sends 5 samples per second', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    let selectedAt = -1;
    for (let t = 0; t <= 1500 && selectedAt < 0; t += 200) if (dwell.update(2, 'A', centre('A:option:1'), t).selectedId) selectedAt = t;
    expect(selectedAt).toBe(600);
  });

  it('lets a child change their mind after a selection without draining a full bar first', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    const first = hold(dwell, 2, centre('A:option:1'), 0, 660);
    expect(first.progress).toBe(0);
    // Resting on the chosen tile neither refills it nor selects it again.
    const resting = hold(dwell, 2, centre('A:option:1'), 726, 2000);
    expect(resting).toEqual({ targetId: 'A:option:1', progress: 0, selectedId: null });
    let selectedAt = -1;
    for (let t = 2066; t <= 4000 && selectedAt < 0; t += 66) if (dwell.update(2, 'A', centre('A:option:2'), t).selectedId === 'A:option:2') selectedAt = t;
    expect(selectedAt - 2066).toBeLessThanOrEqual(660);
  });

  it('moves to a new tile only after the old one drains', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    hold(dwell, 2, centre('A:option:1'), 0, 264);
    expect(dwell.update(2, 'A', centre('A:option:2'), 330).targetId).toBe('A:option:1');
    expect(hold(dwell, 2, centre('A:option:2'), 396, 1200).targetId).toBe('A:option:2');
  });

  it('only lets each team select tiles on its own half', () => {
    const dwell = new DwellTracker();
    dwell.setTargets(targets);
    expect(dwell.targetAt('A', centre('B:option:1'))).toBeNull();
    expect(dwell.targetAt('B', centre('B:option:1'))?.id).toBe('B:option:1');
  });

  it('hit-tests with a small slop', () => {
    expect(contains({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, { x: 0.205, y: 0.15 }, 0.01)).toBe(true);
    expect(contains({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, { x: 0.25, y: 0.15 }, 0.01)).toBe(false);
  });
});

describe('pointer hub', () => {
  const targets = choiceTargets(numbers(1, 2, 3, 4), ['A', 'B']);
  const tile = targets.find((t) => t.id === 'A:option:3')!;
  const centre = { x: tile.rect.x + tile.rect.width / 2, y: tile.rect.y + tile.rect.height / 2 };

  const setup = () => {
    let now = 0;
    const hub = new PointerHub(() => now);
    hub.setTargets(targets);
    const progress: [string, number][] = [];
    const selected: string[] = [];
    const cursors: [number, boolean][] = [];
    hub.subscribeProgress((id, p) => progress.push([id, p]));
    hub.onSelect((_team, t) => selected.push(t.id));
    hub.subscribe((s) => cursors.push([s.pointerId, s.point !== null]));
    return { hub, progress, selected, cursors, at: (t: number) => (now = t) };
  };

  it('lets either hand answer, and shows the fill of the furthest hand', () => {
    const { hub, progress, selected, at } = setup();
    for (let t = 0; t <= 400; t += 66) {
      at(t);
      hub.move(1, 1, centre); // right hand on the tile
      hub.move(1, 0, { x: 0.02, y: 0.02 }); // left hand elsewhere
    }
    expect(progress.at(-1)![0]).toBe('A:option:3');
    expect(progress.at(-1)![1]).toBeGreaterThan(0.5);
    for (let t = 466; t <= 800; t += 66) {
      at(t);
      hub.move(1, 1, centre);
    }
    expect(selected).toEqual(['A:option:3']);
  });

  it('drops a hand that stops updating, and clears its fill', () => {
    const { hub, progress, cursors, at } = setup();
    at(0);
    hub.move(1, 0, centre);
    at(66);
    hub.move(1, 0, centre);
    at(1000);
    hub.sweep();
    expect(cursors.at(-1)).toEqual([2, false]);
    expect(progress.at(-1)).toEqual(['A:option:3', 0]);
  });

  it('lets a hand from any lane answer when one player has the whole wall', () => {
    let now = 0;
    const hub = new PointerHub(() => now);
    hub.setTeamCount(1);
    const solo = choiceTargets(numbers(1, 2, 3, 4), ['A']);
    hub.setTargets(solo);
    const selected: [string, string][] = [];
    hub.onSelect((team, t) => selected.push([team, t.id]));
    const r = solo[3]!.rect;
    // Player 2 would be team B with two teams; alone on the wall it is the one player.
    for (now = 0; now <= 700; now += 66) hub.move(2, 0, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
    expect(selected).toEqual([['A', 'A:option:3']]);
  });

  it('drops the hands it tracks when the team count changes, so cursors come back in their new colour', () => {
    const { hub, at } = setup();
    const samples: [number, string, boolean][] = [];
    hub.subscribe((s) => samples.push([s.pointerId, s.team, s.point !== null]));
    at(0);
    hub.move(2, 0, centre);
    hub.setTeamCount(1);
    hub.move(2, 0, centre);
    expect(samples).toEqual([
      [4, 'B', true],
      [4, 'B', false],
      [4, 'A', true],
    ]);
  });

  it('keeps the TV-remote cursor alive while it rests', () => {
    const { hub, cursors, at } = setup();
    at(0);
    hub.move(1, 0, centre);
    at(700);
    hub.keepAlive(1, 0);
    at(1200);
    hub.sweep();
    expect(cursors.at(-1)).toEqual([2, true]);
  });
});

describe('tiles per card', () => {
  it('puts two or three tiles side by side on a team half, full height', () => {
    for (const n of [2, 3]) {
      const targets = choiceTargets(numbers(...Array.from({ length: n }, (_, i) => i + 1)), ['A', 'B']);
      expect(targets).toHaveLength(2 * n);
      for (const t of targets) expect(t.rect.height).toBeCloseTo(TEAM_AREA[t.team].height);
      expect(targets.filter((t) => t.team === 'A').map((t) => t.value)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
});
