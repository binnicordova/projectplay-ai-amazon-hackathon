/**
 * Translates the session (and the phone link) into the pet's own view of the class. This is the
 * only place the pet reads session internals: session rules can change shape without the pet
 * noticing, as long as this stays true.
 */
import type { LinkStatus } from '../../link/application/linkClient';
import { endingOf } from '@mimikai/pet';
import { starsFor } from '../../session/domain/scoring';
import { BIG_STREAK, FEEDBACK_MS, HURRY_MS, playingTeams, questionTimeMs, summaryOf, type SessionState } from '../../session/domain/session';
import type { ClassMoment } from '../domain/moment';

/** The summary screen appears first; the energy ball starts a moment later. */
export const ENERGY_BALL_DELAY_MS = 800;

export function momentOf(link: LinkStatus, session: SessionState): ClassMoment {
  switch (session.phase) {
    case 'lobby':
      return link.state === 'connected' ? { kind: 'lobby' } : { kind: 'offline' };
    case 'question': {
      const { round, config, progress, teams } = session;
      const playing = playingTeams(config);
      const endsAt = round.startedAt + questionTimeMs(config, round.card);
      return {
        kind: 'question',
        round: round.number,
        title: config.lesson.title,
        startedAt: round.startedAt,
        endsAt,
        hurryAt: endsAt - HURRY_MS,
        chosen: playing.some((team) => round.answers[team] !== null),
        level: progress.level,
        teams: playing.map((team) => ({ team, streak: teams[team].streak })),
      };
    }
    case 'feedback': {
      const { round, config, progress, teams, outcome, feedbackAt } = session;
      // The party starts once the answer panel has had its time.
      const at = feedbackAt + FEEDBACK_MS;
      const { milestone } = outcome;
      return {
        kind: 'feedback',
        round: round.number,
        at: feedbackAt,
        level: progress.level,
        levelChange: outcome.level,
        teams: playingTeams(config).map((team) => ({ team, streak: teams[team].streak, correct: round.answers[team]?.correct ?? false })),
        celebration:
          milestone === null
            ? null
            : milestone.kind === 'levelUp'
              ? { at, kind: 'levelUp', level: milestone.level }
              : { at, kind: 'streak', teams: milestone.teams, streak: milestone.streak, big: milestone.streak === BIG_STREAK },
      };
    }
    case 'summary': {
      const playing = playingTeams(session.config);
      // Two teams add their right answers together: the ball is the whole class's.
      const rightAnswers = playing.reduce((sum, team) => sum + session.teams[team].correct, 0);
      const stars = starsFor(rightAnswers, session.rounds * playing.length);
      // Only a record that existed can be beaten: a lesson's first class gets the ending it earned.
      const { record } = session.config;
      const recordBeaten = record !== undefined && summaryOf(session).best > record;
      return {
        kind: 'summary',
        level: session.topLevel,
        teams: playing.map((team) => ({ team, streak: session.teams[team].streak })),
        bestStreak: Math.max(0, ...playing.map((team) => session.teams[team].bestStreak)),
        ball: { at: session.endedAt + ENERGY_BALL_DELAY_MS, ending: endingOf(stars, recordBeaten), rightAnswers },
      };
    }
  }
}
