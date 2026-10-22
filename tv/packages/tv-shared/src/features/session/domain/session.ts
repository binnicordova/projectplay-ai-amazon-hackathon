/**
 * The classroom game, as a pure reducer. The TV owns the rules; the phone only
 * reports bodies and sends teacher commands. Time is always passed in (`now`),
 * so every rule is deterministic and unit-testable.
 */
import {
  DEFAULT_TEAM_COUNT,
  ZERO_SCORES,
  teamsFor,
  type GameMode,
  type Scores,
  type SessionConfig,
  type SessionSnapshot,
  type SkillId,
  type TeamCount,
  type TeamId,
  type TvMessage,
} from '@projectplay/contracts';
import { generateQuestion, nextLevel, type Level, type Question, type Skill } from '@projectplay/exercise-engine';

// The protocol's skills and the engine's skills must stay the same set.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const skillsMatch: Same<SkillId, Skill> = true;
void skillsMatch;

/**
 * A question always runs for its full time. Children change their minds while they think
 * (and while they watch the other team), so a choice only counts once the time is up; ending
 * the round as soon as everyone had chosen took that away. The teacher can still skip ahead.
 */
export const QUESTION_TIME_MS: Readonly<Record<GameMode, number>> = { choice: 20_000, trueFalse: 15_000 };
export const FEEDBACK_MS = 3_500;
export const STARTING_LEVEL: Level = 2;

/** A team's current choice. It can change until the time is up; the last one counts. */
export interface Answer {
  readonly value: number | boolean;
  readonly correct: boolean;
  /** When the team made this choice, ms after the question started. */
  readonly atMs: number;
}

export interface Round {
  readonly number: number;
  readonly question: Question;
  readonly startedAt: number;
  readonly answers: Readonly<Record<TeamId, Answer | null>>;
}

interface Running {
  readonly config: SessionConfig;
  readonly level: Level;
  readonly scores: Scores;
  readonly round: Round;
}

export type SessionState =
  | { readonly phase: 'lobby' }
  | ({ readonly phase: 'question' } & Running)
  | ({ readonly phase: 'feedback'; readonly feedbackAt: number } & Running)
  | { readonly phase: 'summary'; readonly config: SessionConfig; readonly scores: Scores };

export type SessionEvent =
  | { readonly type: 'start'; readonly config: SessionConfig; readonly now: number }
  /** A team chose a tile (numbers for choice, booleans for true/false). A later choice replaces it. */
  | { readonly type: 'answer'; readonly team: TeamId; readonly value: number | boolean; readonly now: number }
  | { readonly type: 'tick'; readonly now: number }
  | { readonly type: 'next'; readonly now: number }
  | { readonly type: 'end' };

export const INITIAL_SESSION: SessionState = { phase: 'lobby' };

const NO_ANSWERS: Record<TeamId, Answer | null> = { A: null, B: null };

export const teamCountOf = (config: SessionConfig): TeamCount => config.teams ?? DEFAULT_TEAM_COUNT;

/** The teams on the wall in this session, left to right (one player = team A on the whole wall). */
export const playingTeams = (config: SessionConfig): readonly TeamId[] => teamsFor(teamCountOf(config));

function makeRound(config: SessionConfig, level: Level, number: number, now: number): Round {
  const question = generateQuestion({ skill: config.skill, level, seed: config.seed, round: number });
  return { number, question, startedAt: now, answers: NO_ANSWERS };
}

export function isCorrect(question: Question, mode: GameMode, value: number | boolean): boolean {
  if (mode === 'trueFalse') return value === question.statement.isTrue;
  return value === question.answer;
}

function withAnswer(state: Running, team: TeamId, value: number | boolean, now: number): Running {
  const answer: Answer = { value, correct: isCorrect(state.round.question, state.config.mode, value), atMs: now - state.round.startedAt };
  return { ...state, round: { ...state.round, answers: { ...state.round.answers, [team]: answer } } };
}

function toFeedback(state: Running, now: number): SessionState {
  const answers = playingTeams(state.config).map((t) => state.round.answers[t]).filter((a): a is Answer => a !== null);
  const correct = answers.filter((a) => a.correct).length;
  const scores: Scores = {
    A: state.scores.A + (state.round.answers.A?.correct ? 1 : 0),
    B: state.scores.B + (state.round.answers.B?.correct ? 1 : 0),
  };
  return { ...state, phase: 'feedback', feedbackAt: now, scores, level: nextLevel(state.level, correct, answers.length) };
}

function advance(state: Running, now: number): SessionState {
  if (state.round.number >= state.config.rounds) return { phase: 'summary', config: state.config, scores: state.scores };
  return { ...state, phase: 'question', round: makeRound(state.config, state.level, state.round.number + 1, now) };
}

export function reduceSession(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'start':
      return { phase: 'question', config: event.config, level: STARTING_LEVEL, scores: ZERO_SCORES, round: makeRound(event.config, STARTING_LEVEL, 1, event.now) };

    case 'end':
      return state.phase === 'summary' || state.phase === 'lobby' ? INITIAL_SESSION : { phase: 'summary', config: state.config, scores: state.scores };

    case 'answer':
      if (state.phase !== 'question') return state;
      // A team that is not on the wall has no tiles to choose (a stray hand from a second lane).
      if (!playingTeams(state.config).includes(event.team)) return state;
      if (state.config.mode === 'choice' && typeof event.value !== 'number') return state;
      if (state.config.mode === 'trueFalse' && typeof event.value !== 'boolean') return state;
      // Holding on the tile already chosen changes nothing (and keeps the time of the choice).
      if (state.round.answers[event.team]?.value === event.value) return state;
      return { ...state, ...withAnswer(state, event.team, event.value, event.now) };

    case 'tick': {
      if (state.phase === 'feedback') return event.now - state.feedbackAt >= FEEDBACK_MS ? advance(state, event.now) : state;
      if (state.phase !== 'question') return state;
      // Most ticks change nothing: keep the same object so React and subscribers stay idle.
      return event.now - state.round.startedAt >= QUESTION_TIME_MS[state.config.mode] ? toFeedback(state, event.now) : state;
    }

    case 'next':
      if (state.phase === 'question') return toFeedback(state, event.now);
      if (state.phase === 'feedback') return advance(state, event.now);
      return state;
  }
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

/** What the teacher's phone needs to mirror the TV. */
export function snapshotOf(state: SessionState): SessionSnapshot {
  switch (state.phase) {
    case 'lobby':
      return { phase: 'lobby', round: 0, rounds: 0, mode: null, prompt: null, scores: ZERO_SCORES };
    case 'summary':
      return {
        phase: 'summary',
        round: state.config.rounds,
        rounds: state.config.rounds,
        mode: state.config.mode,
        prompt: null,
        scores: state.scores,
        teams: teamCountOf(state.config),
      };
    default:
      return {
        phase: state.phase,
        round: state.round.number,
        rounds: state.config.rounds,
        mode: state.config.mode,
        prompt: promptOf(state.round.question, state.config.mode),
        scores: state.scores,
        teams: teamCountOf(state.config),
      };
  }
}

/**
 * The summary's headline. Two teams get a winner; one player has nobody to beat, so the
 * headline praises how many they got right instead.
 */
export function summaryTitle(config: SessionConfig, scores: Scores): string {
  if (teamCountOf(config) === 1) {
    if (scores.A >= config.rounds) return 'Perfect score!';
    return scores.A * 2 >= config.rounds ? 'Great job!' : 'Good try! Let’s play again';
  }
  if (scores.A === scores.B) return 'Everyone wins today!';
  return `Team ${scores.A > scores.B ? 'A' : 'B'} wins!`;
}

export function promptOf(question: Question, mode: GameMode): string {
  return mode === 'trueFalse' ? question.statement.text : question.prompt;
}

/** Results to report when a round has just ended (each team's final choice, or one "time up" if nobody chose). */
export function roundResults(state: SessionState): Extract<TvMessage, { t: 'result' }>[] {
  if (state.phase !== 'feedback') return [];
  const answered = playingTeams(state.config).flatMap((team) => {
    const answer = state.round.answers[team];
    return answer ? [{ t: 'result' as const, round: state.round.number, correct: answer.correct, team, ms: Math.round(answer.atMs) }] : [];
  });
  if (answered.length > 0) return answered;
  return [{ t: 'result', round: state.round.number, correct: false, team: null, ms: QUESTION_TIME_MS[state.config.mode] }];
}

export const timeLeftMs = (state: SessionState, now: number): number =>
  state.phase === 'question' ? Math.max(0, QUESTION_TIME_MS[state.config.mode] - (now - state.round.startedAt)) : 0;
