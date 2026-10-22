/**
 * @projectplay/exercise-engine
 *
 * Offline, deterministic arithmetic exercises for early-grade maths, with
 * wrong answers built from real misconceptions (counting slips, wrong operation,
 * copying a number from the question, place-value errors) instead of random noise.
 *
 * - Pure TypeScript, zero dependencies, runs anywhere (React Native, Vega OS, Node, web).
 * - Every answer is correct by construction: no model can hallucinate an answer key.
 * - Seeded: the same (seed, round) always produces the same question.
 */
import { mixSeed, mulberry32, randomInt, shuffle, type Random } from './random';

export { mixSeed, mulberry32 } from './random';

export type Skill = 'addition' | 'subtraction' | 'missingAddend';
export const SKILLS: readonly Skill[] = ['addition', 'subtraction', 'missingAddend'];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
export type Level = 1 | 2 | 3 | 4 | 5;

export type Operator = '+' | '−';

export interface Equation {
  readonly left: number;
  readonly operator: Operator;
  readonly right: number;
  readonly result: number;
}

export interface Question {
  readonly id: string;
  readonly skill: Skill;
  readonly level: Level;
  readonly equation: Equation;
  /** Which part of the equation the child must find. */
  readonly unknown: 'left' | 'result';
  readonly answer: number;
  /** e.g. "7 + 8 = ?" or "? + 9 = 16" */
  readonly prompt: string;
  /** Four choices including the answer exactly once, in display order. */
  readonly options: readonly number[];
  /** The equation shown with a candidate value, for true/false games. */
  readonly statement: { readonly text: string; readonly value: number; readonly isTrue: boolean };
}

export interface QuestionRequest {
  readonly skill: Skill;
  readonly level: Level;
  readonly seed: number;
  readonly round: number;
  /** Keep answers small, e.g. 10 for answers children show on their fingers. */
  readonly maxAnswer?: number;
}

/** Largest result per level: within 5, within 10, within 20, to 50, to 100. */
const MAX_RESULT: Readonly<Record<Level, number>> = { 1: 5, 2: 10, 3: 20, 4: 50, 5: 100 };

export const clampLevel = (level: number): Level => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level))) as Level;

function pickEquation(random: Random, skill: Skill, level: Level, maxAnswer: number): { equation: Equation; unknown: 'left' | 'result' } {
  const maxResult = MAX_RESULT[level];
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = randomInt(random, level === 1 ? 2 : Math.ceil(maxResult / 3), maxResult);
    const left = randomInt(random, 1, result - 1);
    const right = result - left;
    if (right < 1) continue;
    if (skill === 'subtraction') {
      // result − right = left: the answer is `left`.
      if (left > maxAnswer) continue;
      return { equation: { left: result, operator: '−', right, result: left }, unknown: 'result' };
    }
    if (skill === 'missingAddend') {
      if (left > maxAnswer) continue;
      return { equation: { left, operator: '+', right, result }, unknown: 'left' };
    }
    if (result > maxAnswer) continue;
    return { equation: { left, operator: '+', right, result }, unknown: 'result' };
  }
  // Tiny ranges (e.g. maxAnswer 1) — fall back to the simplest equation.
  return skill === 'subtraction'
    ? { equation: { left: 2, operator: '−', right: 1, result: 1 }, unknown: 'result' }
    : { equation: { left: 1, operator: '+', right: 1, result: 2 }, unknown: skill === 'missingAddend' ? 'left' : 'result' };
}

const answerOf = (eq: Equation, unknown: 'left' | 'result') => (unknown === 'left' ? eq.left : eq.result);

export function formatEquation(eq: Equation, unknown: 'left' | 'result' | null, value?: number): string {
  const slot = (part: 'left' | 'result', actual: number) => (unknown === part ? (value === undefined ? '?' : String(value)) : String(actual));
  return `${slot('left', eq.left)} ${eq.operator} ${eq.right} = ${slot('result', eq.result)}`;
}

/** Wrong answers children actually give, most telling first. */
export function misconceptions(eq: Equation, unknown: 'left' | 'result'): number[] {
  const answer = answerOf(eq, unknown);
  const candidates: number[] = [];
  if (unknown === 'left') {
    // ? + b = c → children add instead (c + b), copy the total (c) or copy the addend (b).
    candidates.push(eq.result + eq.right, eq.result, eq.right);
  } else if (eq.operator === '+') {
    candidates.push(Math.abs(eq.left - eq.right));
  } else {
    candidates.push(eq.left + eq.right);
  }
  candidates.push(answer + 1, answer - 1);
  if (answer >= 10) {
    candidates.push(answer + 10, answer - 10);
    const reversed = Number(String(answer).split('').reverse().join(''));
    if (reversed !== answer) candidates.push(reversed);
  }
  return candidates;
}

function buildOptions(random: Random, eq: Equation, unknown: 'left' | 'result', count: number): number[] {
  const answer = answerOf(eq, unknown);
  const ceiling = Math.max(10, answer * 2 + 10);
  const valid = (n: number) => Number.isInteger(n) && n >= 0 && n <= ceiling && n !== answer;
  const distractors: number[] = [];
  const add = (n: number) => {
    if (valid(n) && !distractors.includes(n) && distractors.length < count - 1) distractors.push(n);
  };
  // Keep one or two misconceptions in a random order, then fill with near misses.
  shuffle(random, misconceptions(eq, unknown)).forEach(add);
  for (let delta = 2; distractors.length < count - 1 && delta < ceiling; delta++) {
    add(answer + delta);
    add(answer - delta);
  }
  return shuffle(random, [answer, ...distractors]);
}

export function generateQuestion({ skill, level, seed, round, maxAnswer = Infinity }: QuestionRequest): Question {
  const random = mulberry32(mixSeed(seed, round, skill, level, maxAnswer));
  const { equation, unknown } = pickEquation(random, skill, clampLevel(level), maxAnswer);
  const answer = answerOf(equation, unknown);
  const options = buildOptions(random, equation, unknown, 4);
  const isTrue = random() < 0.5;
  const wrong = options.find((o) => o !== answer) ?? answer + 1;
  const shown = isTrue ? answer : wrong;
  return {
    id: `${seed}:${round}:${skill}:${level}`,
    skill,
    level: clampLevel(level),
    equation,
    unknown,
    answer,
    prompt: formatEquation(equation, unknown),
    options,
    statement: { text: formatEquation(equation, unknown, shown), value: shown, isTrue },
  };
}

/**
 * Class-level adaptive difficulty (a simple staircase):
 * everyone right → harder, everyone wrong → easier, mixed → stay.
 */
export function nextLevel(level: Level, correct: number, attempts: number): Level {
  if (attempts <= 0) return level;
  if (correct === attempts) return clampLevel(level + 1);
  if (correct === 0) return clampLevel(level - 1);
  return level;
}
