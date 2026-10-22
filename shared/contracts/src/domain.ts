/**
 * Shared kernel: the vocabulary both apps agree on.
 * Pure TypeScript, zero runtime dependencies, never imports react-native.
 */

/** Stable id the teacher phone assigns to each tracked child. */
export type PlayerId = number;

/** Children are split into two teams by which half of the projection they stand in. */
export type TeamId = 'A' | 'B';
export const TEAMS: readonly TeamId[] = ['A', 'B'];

/**
 * How many teams share the wall.
 * - 2: team A plays on the left half, team B on the right.
 * - 1: one child at a time plays on the whole wall (a small group taking turns, or a child at
 *   home). That child is team A, so scores, results and colours keep the same shape.
 */
export type TeamCount = 1 | 2;
export const TEAM_COUNTS: readonly TeamCount[] = [1, 2];
/** Phones and TVs from before one-player mode send no team count: they always played two teams. */
export const DEFAULT_TEAM_COUNT: TeamCount = 2;

const ONE_TEAM: readonly TeamId[] = ['A'];

/** The teams playing, left to right on the wall. */
export const teamsFor = (count: TeamCount): readonly TeamId[] => (count === 1 ? ONE_TEAM : TEAMS);

/** A point in projection space: (0,0) is the top-left of the projected image, (1,1) the bottom-right. */
export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

/** Curriculum skills the exercise engine can generate. */
export type SkillId = 'addition' | 'subtraction' | 'missingAddend';
export const SKILLS: readonly SkillId[] = ['addition', 'subtraction', 'missingAddend'];

/**
 * Game templates. Children always answer the same way, by pointing at the wall and holding
 * their hand on a tile: in the classroom that is what they do by themselves, so it is the
 * only interaction (whole-body gestures and jump counting were removed after field tests).
 */
export type GameMode =
  /** Four number tiles per team. */
  | 'choice'
  /** A statement on top; TRUE and FALSE tiles per team. */
  | 'trueFalse';
export const GAME_MODES: readonly GameMode[] = ['choice', 'trueFalse'];

export type SessionPhase = 'lobby' | 'question' | 'feedback' | 'summary';
export const SESSION_PHASES: readonly SessionPhase[] = ['lobby', 'question', 'feedback', 'summary'];

export type Scores = Readonly<Record<TeamId, number>>;
export const ZERO_SCORES: Scores = { A: 0, B: 0 };

/** Team owning a point in projection space. */
export function teamForX(x: number): TeamId {
  return x < 0.5 ? 'A' : 'B';
}

/**
 * The phone tracks one child per camera lane: player 1 is the left lane (team A),
 * player 2 the right lane (team B). Odd ids stay on A if more lanes are added later.
 * With one team, every player is on it, whichever lane (or touchpad half) they come from.
 */
export function teamForPlayer(player: PlayerId, teamCount: TeamCount = DEFAULT_TEAM_COUNT): TeamId {
  if (teamCount === 1) return 'A';
  return player % 2 === 1 ? 'A' : 'B';
}

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
