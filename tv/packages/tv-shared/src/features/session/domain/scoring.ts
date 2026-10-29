/**
 * Points, streaks and stars. Every right answer scores; harder cards, quick final choices and
 * answer streaks score more. Wrong answers never cost points: children keep trying.
 */
import { TEAMS, type Level, type Scores, type TeamId } from '@mimikai/contracts';

export interface TeamStats {
  readonly points: number;
  readonly correct: number;
  /** Right answers in a row right now. */
  readonly streak: number;
  readonly bestStreak: number;
}

export const NO_STATS: TeamStats = { points: 0, correct: 0, streak: 0, bestStreak: 0 };
export const NO_TEAM_STATS: Readonly<Record<TeamId, TeamStats>> = { A: NO_STATS, B: NO_STATS };

const BASE: Readonly<Record<Level, number>> = { 1: 100, 2: 150, 3: 200 };
const SPEED_BONUS = 50;
const STREAK_STEP = 25;
const STREAK_CAP = 100;

/**
 * Points for a right answer: the card's level, up to 50 for deciding fast (the time of the final
 * choice counts, so changing your mind late costs speed, not the answer), and 25 per answer
 * already in the streak, up to 100.
 */
export function pointsFor(level: Level, atMs: number, questionMs: number, streakBefore: number): number {
  const speed = Math.round(SPEED_BONUS * Math.max(0, 1 - atMs / questionMs));
  return BASE[level] + speed + Math.min(STREAK_CAP, STREAK_STEP * streakBefore);
}

/** A team's stats after a round: `correct` is null when the team did not answer. */
export function applyRound(stats: TeamStats, correct: boolean | null, points: number): TeamStats {
  if (!correct) return { ...stats, streak: 0 };
  const streak = stats.streak + 1;
  return { points: stats.points + points, correct: stats.correct + 1, streak, bestStreak: Math.max(stats.bestStreak, streak) };
}

export const scoresOf = (teams: Readonly<Record<TeamId, TeamStats>>): Scores => ({ A: teams.A.points, B: teams.B.points });

/** One to three stars for a player alone: everyone who plays earns at least one. */
export function starsFor(correct: number, rounds: number): 1 | 2 | 3 {
  const share = rounds > 0 ? correct / rounds : 0;
  return share >= 0.85 ? 3 : share >= 0.5 ? 2 : 1;
}

/** The team with more points, or null on a tie. */
export function leader(teams: Readonly<Record<TeamId, TeamStats>>, playing: readonly TeamId[] = TEAMS): TeamId | null {
  if (playing.length < 2) return null;
  const [a, b] = [teams[playing[0]!].points, teams[playing[1]!].points];
  return a === b ? null : a > b ? playing[0]! : playing[1]!;
}
