/**
 * Board layouts in projection space (0..1). The same rectangles are used to draw
 * the tiles and to hit-test children's hands, so what you see is what you can touch.
 * Two teams each own one half of the wall, matching the camera lanes on the phone;
 * one player gets the whole wall (the phone then looks at it with a single lane).
 */
import { visualText, type TeamId, type Visual } from '@mimikai/contracts';
import type { NormalizedRect, Target } from './dwell';

export const TEAM_AREA: Readonly<Record<TeamId, NormalizedRect>> = {
  A: { x: 0.03, y: 0.34, width: 0.44, height: 0.56 },
  B: { x: 0.53, y: 0.34, width: 0.44, height: 0.56 },
};

/** One player's board: both team halves and the gap between them. */
export const WHOLE_WALL: NormalizedRect = { x: TEAM_AREA.A.x, y: TEAM_AREA.A.y, width: TEAM_AREA.B.x + TEAM_AREA.B.width - TEAM_AREA.A.x, height: TEAM_AREA.A.height };

const GAP = 0.025;

/** Where a team's tiles go: its half of the wall, or all of it when it plays alone. */
export const areaOf = (team: TeamId, teams: readonly TeamId[]): NormalizedRect => (teams.length === 1 ? WHOLE_WALL : TEAM_AREA[team]);

function grid(area: NormalizedRect, columns: number, rows: number): NormalizedRect[] {
  const width = (area.width - GAP * (columns - 1)) / columns;
  const height = (area.height - GAP * (rows - 1)) / rows;
  const cells: NormalizedRect[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) cells.push({ x: area.x + c * (width + GAP), y: area.y + r * (height + GAP), width, height });
  return cells;
}

export const optionTargetId = (team: TeamId, index: number) => `${team}:option:${index}`;
export const truthTargetId = (team: TeamId, value: boolean) => `${team}:truth:${value}`;

export interface BoardTarget extends Target {
  readonly team: TeamId;
  /** The option's index (choice cards) or true/false. */
  readonly value: number | boolean;
  /** What the tile shows. */
  readonly visual: Visual;
  /** The tile in words (for logs and tests). */
  readonly label: string;
}

/**
 * Two to four answer tiles per team on its half: side by side up to three (tall tiles that small
 * arms reach), 2 × 2 for four. One player gets them in a single row across the whole wall:
 * each tile is as tall as the board, so a child of any height reaches every answer, and
 * choosing one means walking to it.
 */
export function choiceTargets(options: readonly Visual[], teams: readonly TeamId[]): BoardTarget[] {
  return teams.flatMap((team) => {
    const area = areaOf(team, teams);
    const cells = teams.length === 1 || options.length <= 3 ? grid(area, options.length, 1) : grid(area, 2, Math.ceil(options.length / 2));
    return cells.slice(0, options.length).map((rect, i) => ({
      id: optionTargetId(team, i),
      rect,
      team,
      value: i,
      visual: options[i]!,
      label: visualText(options[i]!),
    }));
  });
}

export const TRUE_LABEL = 'VERDADERO';
export const FALSE_LABEL = 'FALSO';

/** VERDADERO / FALSO tiles per team, below the statement. */
export function truthTargets(teams: readonly TeamId[]): BoardTarget[] {
  return teams.flatMap((team) => {
    const area = areaOf(team, teams);
    const [yes, no] = grid({ ...area, y: area.y + 0.2, height: area.height - 0.2 }, 2, 1);
    return [
      { id: truthTargetId(team, true), rect: yes!, team, value: true, visual: { kind: 'text', text: TRUE_LABEL }, label: TRUE_LABEL },
      { id: truthTargetId(team, false), rect: no!, team, value: false, visual: { kind: 'text', text: FALSE_LABEL }, label: FALSE_LABEL },
    ];
  });
}
