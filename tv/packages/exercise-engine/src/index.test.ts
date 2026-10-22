import { describe, expect, it } from 'vitest';
import { SKILLS, formatEquation, generateQuestion, misconceptions, nextLevel, type Level, type Question } from './index';

const LEVELS: Level[] = [1, 2, 3, 4, 5];

function evaluate(q: Question): boolean {
  const { left, operator, right, result } = q.equation;
  return operator === '+' ? left + right === result : left - right === result;
}

describe('generateQuestion (property checks over many seeds)', () => {
  for (const skill of SKILLS) {
    for (const level of LEVELS) {
      it(`${skill} level ${level}: correct by construction, four unique options`, () => {
        for (let seed = 0; seed < 300; seed++) {
          const q = generateQuestion({ skill, level, seed, round: seed % 7 });
          expect(evaluate(q)).toBe(true);
          expect(q.answer).toBe(q.unknown === 'left' ? q.equation.left : q.equation.result);
          expect(q.prompt).toContain('?');
          expect(q.options).toHaveLength(4);
          expect(new Set(q.options).size).toBe(4);
          expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
          for (const o of q.options) {
            expect(Number.isInteger(o)).toBe(true);
            expect(o).toBeGreaterThanOrEqual(0);
          }
          expect(q.statement.isTrue).toBe(q.statement.value === q.answer);
          expect(Math.max(q.equation.left, q.equation.result)).toBeLessThanOrEqual(100);
        }
      });
    }
  }

  it('is deterministic for the same seed and round', () => {
    const a = generateQuestion({ skill: 'missingAddend', level: 3, seed: 42, round: 2 });
    const b = generateQuestion({ skill: 'missingAddend', level: 3, seed: 42, round: 2 });
    expect(a).toEqual(b);
    const c = generateQuestion({ skill: 'missingAddend', level: 3, seed: 42, round: 3 });
    expect(c.id).not.toBe(a.id);
  });

  it('keeps answers small when asked', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const skill of SKILLS) {
        const q = generateQuestion({ skill, level: 5, seed, round: 1, maxAnswer: 10 });
        expect(q.answer).toBeGreaterThanOrEqual(1);
        expect(q.answer).toBeLessThanOrEqual(10);
      }
    }
  });

  it('stays within small ranges at level 1', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateQuestion({ skill: 'addition', level: 1, seed, round: 0 });
      expect(q.equation.result).toBeLessThanOrEqual(5);
    }
  });
});

describe('misconception distractors', () => {
  it('offers the classic slips for 7 + 8', () => {
    const eq = { left: 7, operator: '+' as const, right: 8, result: 15 };
    expect(misconceptions(eq, 'result')).toEqual(expect.arrayContaining([1, 14, 16, 51]));
  });

  it('offers "added instead of subtracted" and "copied a number" for ? + 9 = 16', () => {
    const eq = { left: 7, operator: '+' as const, right: 9, result: 16 };
    expect(misconceptions(eq, 'left')).toEqual(expect.arrayContaining([25, 16, 9, 6, 8]));
  });

  it('formats equations with the unknown or a candidate value', () => {
    const eq = { left: 7, operator: '+' as const, right: 9, result: 16 };
    expect(formatEquation(eq, 'left')).toBe('? + 9 = 16');
    expect(formatEquation(eq, 'left', 6)).toBe('6 + 9 = 16');
    expect(formatEquation(eq, null)).toBe('7 + 9 = 16');
  });
});

describe('nextLevel staircase', () => {
  it('goes up when everyone is right, down when nobody is, otherwise stays', () => {
    expect(nextLevel(2, 2, 2)).toBe(3);
    expect(nextLevel(2, 0, 2)).toBe(1);
    expect(nextLevel(2, 1, 2)).toBe(2);
    expect(nextLevel(5, 2, 2)).toBe(5);
    expect(nextLevel(1, 0, 2)).toBe(1);
    expect(nextLevel(3, 0, 0)).toBe(3);
  });
});
