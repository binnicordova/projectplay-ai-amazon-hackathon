/**
 * What the rig plays: a mood, when to play it again, which half of the wall it turns to, what it
 * says. Each app decides its own cues (the TV from the class, the phone from the teacher's day);
 * the rig only performs them.
 */
import type { TeamId } from '@mimikai/contracts';
import type { Mood } from './moods';

export interface PetCue {
  readonly mood: Mood;
  /** Changes whenever the mood should play from the start again (a new round, a new tickle). */
  readonly key: string;
  /** The side the pet turns to: the team it waves at, or the team that got it right (A = left). */
  readonly side: TeamId | null;
  /** What it says (Spanish), or null. */
  readonly line: string | null;
  /** The number on the On fire badge. */
  readonly count: number | null;
}

export const sameCue = (a: PetCue, b: PetCue): boolean => a.key === b.key && a.line === b.line && a.side === b.side && a.count === b.count;

/** A cue with no side and no badge. */
export const plainCue = (mood: Mood, key: string, line: string | null = null): PetCue => ({ mood, key, side: null, line, count: null });
