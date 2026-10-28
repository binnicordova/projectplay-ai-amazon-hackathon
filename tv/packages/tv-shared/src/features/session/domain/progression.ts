/**
 * How the class climbs a lesson. Cards come in three levels; the class starts at level 1 and
 * moves up after two strong rounds in a row (or down after two weak ones), so children who are
 * flying get harder cards and a struggling class gets easier ones without anyone choosing.
 *
 * A round's strength is the share of playing teams that got it right: with two teams, one
 * right and one wrong is 0.5; alone, it is 1 or 0.
 */
import { LEVELS, type Card, type Lesson, type Level } from '@mimikai/contracts';
import type { Random } from './random';

export interface Progress {
  readonly level: Level;
  /** Round strengths since the last level change, newest last. */
  readonly recent: readonly number[];
}

export type LevelChange = 'up' | 'down' | null;

export const START_PROGRESS: Progress = { level: 1, recent: [] };

/** Rounds looked at before changing level. */
export const LEVEL_WINDOW = 2;
const UP_AT = 0.75;
const DOWN_AT = 0.25;

const clampLevel = (n: number): Level => Math.min(3, Math.max(1, n)) as Level;

export function afterRound(progress: Progress, correctTeams: number, teams: number): { readonly progress: Progress; readonly change: LevelChange } {
  const recent = [...progress.recent, teams > 0 ? correctTeams / teams : 0].slice(-LEVEL_WINDOW);
  if (recent.length < LEVEL_WINDOW) return { progress: { ...progress, recent }, change: null };
  const average = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (average >= UP_AT && progress.level < 3) return { progress: { level: clampLevel(progress.level + 1), recent: [] }, change: 'up' };
  if (average <= DOWN_AT && progress.level > 1) return { progress: { level: clampLevel(progress.level - 1), recent: [] }, change: 'down' };
  return { progress: { ...progress, recent }, change: null };
}

/** Levels to look in, nearest first; on a tie, the harder level (the class is moving up). */
const searchOrder = (level: Level): readonly Level[] => [...LEVELS].sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || b - a);

/**
 * The next card: an unplayed one at the class's level, else the nearest level that still has
 * unplayed cards, else (everything played) the card at the nearest level played longest ago.
 */
export function pickCard(lesson: Lesson, level: Level, played: readonly string[], random: Random): Card {
  for (const candidateLevel of searchOrder(level)) {
    const fresh = lesson.cards.filter((c) => c.level === candidateLevel && !played.includes(c.id));
    if (fresh.length > 0) return fresh[Math.floor(random() * fresh.length)]!;
  }
  const lastPlayed = (card: Card) => played.lastIndexOf(card.id);
  for (const candidateLevel of searchOrder(level)) {
    const atLevel = lesson.cards.filter((c) => c.level === candidateLevel);
    if (atLevel.length > 0) return atLevel.reduce((oldest, c) => (lastPlayed(c) < lastPlayed(oldest) ? c : oldest));
  }
  return lesson.cards[0]!;
}
