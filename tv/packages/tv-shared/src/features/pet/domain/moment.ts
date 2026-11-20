/**
 * The class as the pet sees it. The session reducer knows cards, answers and points; the pet
 * only needs to know what just happened to each team. Keeping this small language of its own
 * means session rules can change without touching the pet, and pet rules are tested without
 * building lessons (the translation lives in pet/application/classMoment.ts).
 */
import type { Level, TeamId } from '@mimikai/contracts';
import type { Ending } from '@mimikai/pet';

export interface TeamNow {
  readonly team: TeamId;
  /** Right answers in a row right now. */
  readonly streak: number;
}

export interface TeamResult extends TeamNow {
  /** Right this round (false when the team didn't choose). */
  readonly correct: boolean;
}

/** A full-screen party after the answer panel (see the session's milestones). */
export type Celebration =
  | { readonly at: number; readonly kind: 'levelUp'; readonly level: Level }
  | {
      readonly at: number;
      readonly kind: 'streak';
      readonly teams: readonly TeamId[];
      readonly streak: number;
      /** A team's first five in a row: Rayitas bounds through every ring. */
      readonly big: boolean;
    };

/** The energy ball that ends the class: when it starts, how it ends, how many sparks it gathers. */
export interface EnergyBall {
  readonly at: number;
  readonly ending: Ending;
  readonly rightAnswers: number;
}

export type ClassMoment =
  /** No phone linked and no class running. */
  | { readonly kind: 'offline' }
  /** The phone is linked and the teacher is choosing a lesson. */
  | { readonly kind: 'lobby' }
  | {
      readonly kind: 'question';
      readonly round: number;
      /** The lesson's title (said when the class starts). */
      readonly title: string;
      /** When the card opens; round 1 opens after the class's greeting. */
      readonly startedAt: number;
      readonly endsAt: number;
      /** When the countdown turns to its warning colour. */
      readonly hurryAt: number;
      /** Some team has a choice on a tile. */
      readonly chosen: boolean;
      readonly level: Level;
      readonly teams: readonly TeamNow[];
    }
  | {
      readonly kind: 'feedback';
      readonly round: number;
      readonly at: number;
      readonly level: Level;
      readonly levelChange: 'up' | 'down' | null;
      readonly teams: readonly TeamResult[];
      readonly celebration: Celebration | null;
    }
  | {
      readonly kind: 'summary';
      /** Highest level the class reached. */
      readonly level: Level;
      readonly teams: readonly TeamNow[];
      readonly bestStreak: number;
      readonly ball: EnergyBall;
    };
