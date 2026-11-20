/**
 * The classroom game, as a pure reducer. The TV owns the rules; the phone sends the lesson,
 * reports bodies and relays the teacher's commands. Time is always passed in (`now`) and
 * randomness comes from the class seed, so every rule is deterministic and unit-testable.
 *
 * The lesson lives only here, in memory: when the class ends it is gone from the TV.
 */
import {
  DEFAULT_TEAM_COUNT,
  ZERO_SCORES,
  answerText,
  teamsFor,
  visualText,
  type AgeBand,
  type Card,
  type GameMode,
  type Level,
  type SessionConfig,
  type SessionSnapshot,
  type TeamCount,
  type TeamId,
  type TvMessage,
} from '@mimikai/contracts';
import { START_PROGRESS, afterRound, pickCard, type LevelChange, type Progress } from './progression';
import { seededRandom } from './random';
import { NO_TEAM_STATS, applyRound, leader, pointsFor, scoresOf, starsFor, type TeamStats } from './scoring';

/**
 * A card always runs for its full time. Children change their minds while they think (and while
 * they watch the other team), so a choice only counts once the time is up. The teacher can still
 * skip ahead. Pre-readers get longer; teenagers solving equations get longest.
 */
const QUESTION_TIME: Readonly<Record<AgeBand, Readonly<Record<GameMode, number>>>> = {
  inicial: { choice: 25_000, trueFalse: 20_000 },
  primaria: { choice: 20_000, trueFalse: 15_000 },
  secundaria: { choice: 30_000, trueFalse: 20_000 },
};

export const FEEDBACK_MS = 4_000;

/**
 * The class starts with Mimikai greeting it, full screen: the first card opens after this, so
 * the greeting never eats into the children's time (and the TV has a moment to draw the board).
 */
export const INTRO_MS = 3_000;

/**
 * A round that earns a milestone keeps the answer screen up longer for a full-screen party. The
 * party's show must fit: Rayitas jumps through the new ring at a level up, and bounds through
 * every ring at a team's first five in a row (see shared/pet scenes).
 */
export const CELEBRATION_MS = 3_000;
export const LEVEL_UP_PARTY_MS = 4_500;
export const BIG_STREAK_PARTY_MS = 6_000;

/** Right answers in a row worth a celebration. Five is the big one, once per team per class. */
export const STREAK_MILESTONES: readonly number[] = [3, 5, 7, 10];
export const BIG_STREAK = 5;

/** The last seconds of a question: the countdown turns to its warning colour and the pet hurries. */
export const HURRY_MS = 5_000;

export const questionTimeMs = (config: SessionConfig, card: Card): number => QUESTION_TIME[config.lesson.audience.band][card.kind];

/** A team's current choice (an option index, or true/false). It can change until the time is up. */
export interface Answer {
  readonly value: number | boolean;
  readonly correct: boolean;
  /** When the team made this choice, ms after the card appeared. */
  readonly atMs: number;
}

export interface Round {
  readonly number: number;
  readonly card: Card;
  readonly startedAt: number;
  readonly answers: Readonly<Record<TeamId, Answer | null>>;
}

/** Something a round earned the whole class a celebration for (a level up wins over a streak). */
export type Milestone =
  | { readonly kind: 'levelUp'; readonly level: Level }
  | { readonly kind: 'streak'; readonly teams: readonly TeamId[]; readonly streak: number };

/** What the last round changed, for the feedback screen. */
export interface Outcome {
  readonly points: Readonly<Record<TeamId, number>>;
  readonly level: LevelChange;
  readonly milestone: Milestone | null;
}

export function partyMsOf(milestone: Milestone): number {
  if (milestone.kind === 'levelUp') return LEVEL_UP_PARTY_MS;
  return milestone.streak === BIG_STREAK ? BIG_STREAK_PARTY_MS : CELEBRATION_MS;
}

/** How long the answer screen stays: longer when the round earned a celebration. */
export const feedbackMsOf = (outcome: Outcome): number => FEEDBACK_MS + (outcome.milestone ? partyMsOf(outcome.milestone) : 0);

/** The card is open for choosing (round 1 opens after the class's greeting). */
export const isOpen = (round: Round, now: number): boolean => now >= round.startedAt;

interface Running {
  readonly config: SessionConfig;
  readonly progress: Progress;
  readonly teams: Readonly<Record<TeamId, TeamStats>>;
  /** Card ids in the order they were played. */
  readonly played: readonly string[];
  readonly round: Round;
  /** Highest level the class reached so far. */
  readonly topLevel: Level;
}

export interface Finished {
  /** When the class ended: Mimikai's energy ball is timed from it. */
  readonly endedAt: number;
  readonly config: SessionConfig;
  readonly teams: Readonly<Record<TeamId, TeamStats>>;
  readonly rounds: number;
  /** Highest level the class reached. */
  readonly topLevel: Level;
}

export type SessionState =
  | { readonly phase: 'lobby' }
  | ({ readonly phase: 'question' } & Running)
  | ({ readonly phase: 'feedback'; readonly feedbackAt: number; readonly outcome: Outcome } & Running)
  | ({ readonly phase: 'summary' } & Finished);

export type SessionEvent =
  | { readonly type: 'start'; readonly config: SessionConfig; readonly now: number }
  /** A team chose a tile (an option index, or true/false). A later choice replaces it. */
  | { readonly type: 'answer'; readonly team: TeamId; readonly value: number | boolean; readonly now: number }
  | { readonly type: 'tick'; readonly now: number }
  | { readonly type: 'next'; readonly now: number }
  | { readonly type: 'end'; readonly now: number };

export const INITIAL_SESSION: SessionState = { phase: 'lobby' };

const NO_ANSWERS: Readonly<Record<TeamId, Answer | null>> = { A: null, B: null };

export const teamCountOf = (config: SessionConfig): TeamCount => config.teams ?? DEFAULT_TEAM_COUNT;

/** The teams on the wall in this session, left to right (one player = team A on the whole wall). */
export const playingTeams = (config: SessionConfig): readonly TeamId[] => teamsFor(teamCountOf(config));

/** Cards to play: what the teacher asked for, never more than the lesson has. */
export const roundsOf = (config: SessionConfig): number => Math.max(1, Math.min(config.rounds, config.lesson.cards.length));

function makeRound(config: SessionConfig, progress: Progress, played: readonly string[], number: number, now: number): Round {
  const card = pickCard(config.lesson, progress.level, played, seededRandom(config.seed, number));
  return { number, card, startedAt: now, answers: NO_ANSWERS };
}

export function isCorrect(card: Card, value: number | boolean): boolean {
  return card.kind === 'trueFalse' ? value === card.answer : value === card.answer;
}

function start(config: SessionConfig, now: number): SessionState {
  const round = makeRound(config, START_PROGRESS, [], 1, now + INTRO_MS);
  return { phase: 'question', config, progress: START_PROGRESS, teams: NO_TEAM_STATS, played: [round.card.id], round, topLevel: START_PROGRESS.level };
}

function toFeedback(state: Running, now: number): SessionState {
  const { config, round } = state;
  const playing = playingTeams(config);
  const timeMs = questionTimeMs(config, round.card);
  const pointsOf = (team: TeamId): number => {
    const answer = round.answers[team];
    return answer?.correct ? pointsFor(round.card.level, answer.atMs, timeMs, state.teams[team].streak) : 0;
  };
  const points: Record<TeamId, number> = { A: playing.includes('A') ? pointsOf('A') : 0, B: playing.includes('B') ? pointsOf('B') : 0 };
  const statsOf = (team: TeamId): TeamStats => {
    if (!playing.includes(team)) return state.teams[team];
    const answer = round.answers[team];
    return applyRound(state.teams[team], answer ? answer.correct : null, points[team]);
  };
  const correctTeams = playing.filter((t) => round.answers[t]?.correct).length;
  const { progress, change } = afterRound(state.progress, correctTeams, playing.length);
  const teams = { A: statsOf('A'), B: statsOf('B') };
  return {
    ...state,
    phase: 'feedback',
    feedbackAt: now,
    teams,
    progress,
    outcome: { points, level: change, milestone: milestoneOf(change, progress.level, playing, state.teams, teams, round) },
    topLevel: Math.max(state.topLevel, progress.level) as Level,
  };
}

function milestoneOf(
  change: LevelChange,
  level: Level,
  playing: readonly TeamId[],
  before: Readonly<Record<TeamId, TeamStats>>,
  teams: Readonly<Record<TeamId, TeamStats>>,
  round: Round,
): Milestone | null {
  if (change === 'up') return { kind: 'levelUp', level };
  // Five in a row is celebrated the first time only: the big show stays special.
  const counts = (t: TeamId) => teams[t].streak !== BIG_STREAK || before[t].bestStreak < BIG_STREAK;
  const hot = playing.filter((t) => round.answers[t]?.correct && STREAK_MILESTONES.includes(teams[t].streak) && counts(t));
  if (hot.length === 0) return null;
  const streak = Math.max(...hot.map((t) => teams[t].streak));
  return { kind: 'streak', teams: hot.filter((t) => teams[t].streak === streak), streak };
}

function advance(state: Extract<SessionState, { phase: 'feedback' }>, now: number): SessionState {
  const { config, progress, played, round, teams, topLevel } = state;
  if (round.number >= roundsOf(config)) return { phase: 'summary', config, teams, rounds: round.number, topLevel, endedAt: now };
  const next = makeRound(config, progress, played, round.number + 1, now);
  return { phase: 'question', config, progress, teams, played: [...played, next.card.id], round: next, topLevel };
}

export function reduceSession(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'start':
      return start(event.config, event.now);

    case 'end':
      if (state.phase === 'summary' || state.phase === 'lobby') return INITIAL_SESSION;
      return {
        phase: 'summary',
        config: state.config,
        teams: state.teams,
        rounds: state.round.number - (state.phase === 'question' ? 1 : 0),
        topLevel: state.topLevel,
        endedAt: event.now,
      };

    case 'answer': {
      if (state.phase !== 'question') return state;
      // A team that is not on the wall has no tiles to choose (a stray hand from a second lane).
      if (!playingTeams(state.config).includes(event.team)) return state;
      const { card } = state.round;
      if (card.kind === 'choice' && (typeof event.value !== 'number' || event.value < 0 || event.value >= card.options.length)) return state;
      if (card.kind === 'trueFalse' && typeof event.value !== 'boolean') return state;
      // Tiles open after the class's greeting; a hand that strays there earlier chooses nothing.
      if (!isOpen(state.round, event.now)) return state;
      // Holding on the tile already chosen changes nothing (and keeps the time of the choice).
      if (state.round.answers[event.team]?.value === event.value) return state;
      const answer: Answer = { value: event.value, correct: isCorrect(card, event.value), atMs: event.now - state.round.startedAt };
      return { ...state, round: { ...state.round, answers: { ...state.round.answers, [event.team]: answer } } };
    }

    case 'tick':
      if (state.phase === 'feedback') return event.now - state.feedbackAt >= feedbackMsOf(state.outcome) ? advance(state, event.now) : state;
      if (state.phase !== 'question') return state;
      // Most ticks change nothing: keep the same object so React and subscribers stay idle.
      return event.now - state.round.startedAt >= questionTimeMs(state.config, state.round.card) ? toFeedback(state, event.now) : state;

    case 'next':
      if (state.phase === 'question') return toFeedback(state, event.now);
      if (state.phase === 'feedback') return advance(state, event.now);
      return state;
  }
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

/** One line for the phone's live view, e.g. "¿Con qué letra empieza? · rana". */
export const promptLine = (card: Card): string => (card.prompt.visual ? `${card.prompt.text} · ${visualText(card.prompt.visual)}` : card.prompt.text);

/** What the teacher's phone needs to mirror the TV. */
export function snapshotOf(state: SessionState): SessionSnapshot {
  switch (state.phase) {
    case 'lobby':
      return { phase: 'lobby', round: 0, rounds: 0, mode: null, prompt: null, scores: ZERO_SCORES };
    case 'summary':
      return {
        phase: 'summary',
        round: state.rounds,
        rounds: roundsOf(state.config),
        mode: null,
        prompt: null,
        scores: scoresOf(state.teams),
        teams: teamCountOf(state.config),
        lessonId: state.config.lesson.id,
        level: state.topLevel,
      };
    default:
      return {
        phase: state.phase,
        round: state.round.number,
        rounds: roundsOf(state.config),
        mode: state.round.card.kind,
        prompt: promptLine(state.round.card).slice(0, 300),
        scores: scoresOf(state.teams),
        teams: teamCountOf(state.config),
        lessonId: state.config.lesson.id,
        level: state.round.card.level,
        ...(state.round.card.prompt.say ? { say: state.round.card.prompt.say.slice(0, 200) } : {}),
      };
  }
}

export interface SummaryView {
  readonly title: string;
  /** One player only: 1–3 stars. */
  readonly stars: 1 | 2 | 3 | null;
  readonly winner: TeamId | null;
  /** The best score this time, and whether it beat the record the phone sent. */
  readonly best: number;
  readonly newRecord: boolean;
}

/** The summary's headline. Two teams get a winner; one player gets stars and a record to beat. */
export function summaryOf(state: Extract<SessionState, { phase: 'summary' }>): SummaryView {
  const playing = playingTeams(state.config);
  const best = Math.max(...playing.map((t) => state.teams[t].points));
  const newRecord = best > 0 && (state.config.record === undefined || best > state.config.record);
  if (playing.length === 1) {
    const stars = starsFor(state.teams.A.correct, state.rounds);
    const title = stars === 3 ? '¡Perfecto!' : stars === 2 ? '¡Muy bien!' : '¡Buen intento! Juguemos otra vez';
    return { title, stars, winner: null, best, newRecord };
  }
  const winner = leader(state.teams, playing);
  return { title: winner ? `¡Gana el equipo ${winner}!` : '¡Empate! Todos ganan hoy', stars: null, winner, best, newRecord };
}

/** Results to report when a round has just ended (each team's final choice, or one "time up" if nobody chose). */
export function roundResults(state: SessionState): Extract<TvMessage, { t: 'result' }>[] {
  if (state.phase !== 'feedback') return [];
  const answered = playingTeams(state.config).flatMap((team) => {
    const answer = state.round.answers[team];
    return answer
      ? [{ t: 'result' as const, round: state.round.number, correct: answer.correct, team, ms: Math.round(answer.atMs), points: state.outcome.points[team] }]
      : [];
  });
  if (answered.length > 0) return answered;
  return [{ t: 'result', round: state.round.number, correct: false, team: null, ms: questionTimeMs(state.config, state.round.card) }];
}

export const timeLeftMs = (state: SessionState, now: number): number => {
  if (state.phase !== 'question') return 0;
  const total = questionTimeMs(state.config, state.round.card);
  return Math.max(0, Math.min(total, total - (now - state.round.startedAt)));
};

/** The right answer in words, for the feedback line. */
export const solutionOf = (card: Card): string => answerText(card);
