/**
 * Mathematics beyond counting: arithmetic and times tables, fractions with big numbers, and
 * linear equations with the traps teenagers fall into. Wrong options are the answers that
 * those exact mistakes produce, so a wrong choice tells the teacher which mistake it was.
 */
import type { Card, Level } from '@projectplay/contracts';
import { generateQuestion, type Level as ArithmeticLevel, type Skill } from '../arithmetic';
import { buildCards, cycle, optionCount, text, type ChoiceSpec, type GeneratorContext } from '../cards';
import { mixSeed, randomInt, shuffle, type Random } from '../random';

const MINUS = '−';

// ---------------------------------------------------------------------------
// Rational numbers
// ---------------------------------------------------------------------------

interface Fraction {
  readonly n: number;
  readonly d: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);

function reduce({ n, d }: Fraction): Fraction {
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d) || 1;
  return { n: (sign * n) / g, d: (sign * d) / g };
}

const fmtNumber = (x: number): string => (x < 0 ? `${MINUS}${Math.abs(x)}` : String(x));

/** "3/4", "−2/5" or a whole number. */
function fmt(f: Fraction): string {
  const r = reduce(f);
  return r.d === 1 ? fmtNumber(r.n) : `${r.n < 0 ? MINUS : ''}${Math.abs(r.n)}/${r.d}`;
}

const raw = (f: Fraction): string => `${f.n}/${f.d}`;
const valueOf = (f: Fraction): number => f.n / f.d;

const BASES: readonly Fraction[] = [
  { n: 2, d: 3 }, { n: 3, d: 4 }, { n: 2, d: 5 }, { n: 3, d: 5 }, { n: 4, d: 5 }, { n: 5, d: 6 }, { n: 3, d: 8 }, { n: 5, d: 8 },
  { n: 7, d: 8 }, { n: 4, d: 9 }, { n: 5, d: 9 }, { n: 7, d: 10 }, { n: 5, d: 12 }, { n: 7, d: 12 }, { n: 11, d: 12 }, { n: 8, d: 15 },
];

const divisorsOf = (k: number): readonly number[] => Array.from({ length: k - 2 }, (_, i) => i + 2).filter((f) => k % f === 0);

/** Distinct option texts, keeping only those whose value differs from the answer's. */
function distinctValues(correct: Fraction, candidates: readonly Fraction[]): readonly Fraction[] {
  const seen = new Set([valueOf(correct)]);
  return candidates.filter((c) => {
    if (c.d === 0 || !Number.isFinite(valueOf(c)) || seen.has(valueOf(c))) return false;
    seen.add(valueOf(c));
    return true;
  });
}

export interface FractionsParams {
  /** Big numerators and denominators (84/126 rather than 2/3). */
  readonly big?: boolean;
}

/**
 * Level 1 simplifies a big fraction, level 2 finds an equal or the biggest fraction,
 * level 3 adds fractions with different denominators or takes a fraction of a quantity.
 */
export function fractionCards({ big = true }: FractionsParams, ctx: GeneratorContext): readonly Card[] {
  const kRange: [number, number] = big ? [12, 36] : [2, 6];
  const nextBase = cycle(ctx.random, BASES);
  const k = () => randomInt(ctx.random, kRange[0], kRange[1]);
  return buildCards(ctx, (level, index): ChoiceSpec => {
    const options = optionCount(ctx.band, level);
    const base = nextBase()!;
    if (level === 1) return simplify(base, k(), options, ctx.random);
    if (level === 2) return index % 2 === 0 ? equivalent(base, k(), options, ctx.random) : biggest(options, kRange, ctx.random);
    return index % 2 === 0 ? addition(options, big, ctx.random) : fractionOf(base, big, options, ctx.random);
  });
}

function simplify(base: Fraction, k: number, options: number, random: Random): ChoiceSpec {
  const shown = { n: base.n * k, d: base.d * k };
  const partial = divisorsOf(k).map((f) => ({ n: shown.n / f, d: shown.d / f }));
  return {
    level: 1,
    prompt: { text: 'Simplifica la fracción', visual: text(raw(shown)) },
    correct: text(fmt(base)),
    // Stopping halfway gives an equal value written bigger: show those as raw text, they are wrong answers to "simplify".
    distractors: [
      ...shuffle(random, partial).map((f) => text(raw(f))),
      text(raw({ n: base.d, d: base.n })),
      // "1" (when n + 1 = d) is no trap at all: only keep proper fractions.
      ...distinctValues(base, [{ n: base.n + 1, d: base.d }, { n: base.n, d: base.d + 1 }, { n: base.n, d: base.d + 2 }])
        .filter((f) => f.n < f.d)
        .map((f) => text(fmt(f))),
    ],
    options,
    explain: `${shown.n} y ${shown.d} se dividen entre ${k * gcd(base.n, base.d)}: ${raw(shown)} = ${fmt(base)}.`,
  };
}

function equivalent(base: Fraction, k: number, options: number, random: Random): ChoiceSpec {
  const right = { n: base.n * k, d: base.d * k };
  return {
    level: 2,
    prompt: { text: `¿Qué fracción es igual a ${fmt(base)}?` },
    correct: text(raw(right)),
    distractors: shuffle(
      random,
      distinctValues(base, [
        { n: base.n * k + k, d: base.d * k },
        { n: base.n * k, d: base.d * k + base.d },
        { n: base.n + k, d: base.d + k },
        { n: base.d * k, d: base.n * k },
      ]),
    ).map((f) => text(raw(f))),
    options,
    explain: `${raw(right)}: arriba y abajo se multiplicaron por ${k}.`,
  };
}

function biggest(options: number, kRange: [number, number], random: Random): ChoiceSpec {
  // Every base has a different value, so exactly one option is the biggest.
  const shown = shuffle(random, BASES)
    .slice(0, options)
    .map((f) => {
      const m = randomInt(random, kRange[0], kRange[1]);
      return { f, shown: { n: f.n * m, d: f.d * m } };
    });
  const best = shown.reduce((a, b) => (valueOf(b.f) > valueOf(a.f) ? b : a));
  return {
    level: 2,
    prompt: { text: '¿Cuál es la fracción mayor?' },
    correct: text(raw(best.shown)),
    distractors: shown.filter((s) => s !== best).map((s) => text(raw(s.shown))),
    options,
    explain: `Simplificadas: ${shown.map((s) => fmt(s.f)).join(', ')}. La mayor es ${fmt(best.f)}.`,
  };
}

const DENOMINATOR_PAIRS: readonly (readonly [number, number])[] = [
  [12, 18], [15, 20], [16, 24], [14, 21], [20, 30], [18, 24], [9, 12], [10, 15],
];

function addition(options: number, big: boolean, random: Random): ChoiceSpec {
  const [b, d] = DENOMINATOR_PAIRS[randomInt(random, 0, big ? DENOMINATOR_PAIRS.length - 1 : 7)]!;
  // Start from simplified fractions (5/12, not 4/14): the work is the common denominator.
  const properOver = (den: number) => Array.from({ length: den - 1 }, (_, i) => i + 1).filter((x) => gcd(x, den) === 1);
  const a = shuffle(random, properOver(b))[0]!;
  const c = shuffle(random, properOver(d))[0]!;
  const L = lcm(b, d);
  const sum = { n: a * (L / b) + c * (L / d), d: L };
  return {
    level: 3,
    prompt: { text: `${a}/${b} + ${c}/${d} = ?` },
    correct: text(fmt(sum)),
    distractors: [
      // Written the way a student who adds tops and bottoms writes it.
      ...distinctValues(sum, [{ n: a + c, d: b + d }]).map((f) => text(raw(f))),
      ...distinctValues(sum, [{ n: a * (L / b) + c, d: L }, { n: a + c * (L / d), d: L }, { n: sum.n + 1, d: L }]).map((f) => text(fmt(f))),
    ],
    options,
    explain: `Denominador común ${L}: ${a * (L / b)}/${L} + ${c * (L / d)}/${L} = ${fmt(sum)}. Sumar arriba y abajo (${a + c}/${b + d}) es la trampa.`,
  };
}

function fractionOf(base: Fraction, big: boolean, options: number, random: Random): ChoiceSpec {
  const quantity = base.d * randomInt(random, big ? 20 : 2, big ? 120 : 10);
  const answer = (quantity / base.d) * base.n;
  const candidates = [quantity / base.d, quantity * base.n, answer + base.d, answer - base.n, Math.round((quantity / base.n) * base.d)];
  const seen = new Set([answer]);
  const wrong = candidates.filter((x) => Number.isInteger(x) && x > 0 && !seen.has(x) && (seen.add(x), true));
  return {
    level: 3,
    prompt: { text: `¿Cuánto es ${fmt(base)} de ${quantity}?` },
    correct: text(String(answer)),
    distractors: wrong.map((x) => text(String(x))),
    options,
    explain: `${quantity} ÷ ${base.d} = ${quantity / base.d}, y por ${base.n} = ${answer}.`,
  };
}

// ---------------------------------------------------------------------------
// Equations with traps
// ---------------------------------------------------------------------------

type Template = (random: Random) => { readonly prompt: string; readonly correct: string; readonly traps: readonly string[]; readonly explain: string };

const xEq = (value: number | Fraction): string => `x = ${typeof value === 'number' ? fmtNumber(value) : fmt(value)}`;
/** "+ 5" or "− 5" after a term. */
const signed = (n: number): string => (n < 0 ? `${MINUS} ${Math.abs(n)}` : `+ ${n}`);

const EQUATIONS: Readonly<Record<Level, readonly Template[]>> = {
  1: [
    (r) => {
      const a = randomInt(r, 2, 6);
      const b = randomInt(r, 2, 9);
      const c = b + randomInt(r, 1, 8);
      const x = a * (c - b);
      return {
        prompt: `x/${a} + ${b} = ${c}`,
        correct: xEq(x),
        traps: [xEq({ n: c - b, d: a }), xEq(a * c - b), xEq(a * (c + b))],
        explain: `Resta ${b}: x/${a} = ${c - b}. Luego multiplica por ${a} (dividir es la trampa): x = ${x}.`,
      };
    },
    (r) => {
      const a = randomInt(r, 2, 5);
      const b = randomInt(r, 2, 9);
      const x = b + randomInt(r, 1, 9);
      const c = a * (x - b);
      return {
        prompt: `${a}(x ${MINUS} ${b}) = ${c}`,
        correct: xEq(x),
        traps: [xEq({ n: c + b, d: a }), xEq(c / a - b), xEq(c - a * b)],
        explain: `Reparte el ${a} a los dos: ${a}x ${MINUS} ${a * b} = ${c}. Olvidar multiplicar el ${b} es la trampa.`,
      };
    },
  ],
  2: [
    (r) => {
      const x = randomInt(r, 1, 12);
      const c = randomInt(r, 2, 9);
      const b = x + c + randomInt(r, 1, 15);
      const d = b - x - c;
      return {
        prompt: `${b} ${MINUS} (x + ${c}) = ${d}`,
        correct: xEq(x),
        traps: [xEq(b + c - d), xEq(-x), xEq(b - d)],
        explain: `El menos cambia los dos signos: ${b} ${MINUS} x ${MINUS} ${c} = ${d}, así que x = ${x}.`,
      };
    },
    (r) => {
      const a = randomInt(r, 2, 5);
      const c = a + randomInt(r, 1, 5);
      const x = (r() < 0.5 ? -1 : 1) * randomInt(r, 1, 9);
      // Neither constant may be 0: "7x + 0" would look like a typo on the wall.
      const b = randomInt(r, 1, 9) * (r() < 0.5 ? -1 : 1);
      const d = (a - c) * x + b || b + 1;
      return {
        prompt: `${a}x ${signed(b)} = ${c}x ${signed(d)}`,
        correct: xEq({ n: d - b, d: a - c }),
        traps: [xEq({ n: d - b, d: a + c }), xEq({ n: b - d, d: a - c }), xEq({ n: d + b, d: a - c })],
        explain: `Pasa ${c}x restando: ${a}x ${MINUS} ${c}x = ${fmtNumber(d)} ${signed(-b)}, o sea ${fmtNumber(a - c)}x = ${fmtNumber(d - b)} y ${xEq({ n: d - b, d: a - c })}.`,
      };
    },
  ],
  3: [
    (r) => {
      const k = randomInt(r, 3, 12);
      return {
        prompt: `x² = ${k * k}`,
        correct: `x = ${k} o x = ${MINUS}${k}`,
        traps: [xEq(k), xEq(-k), xEq({ n: k * k, d: 2 })],
        explain: `${k}² y (${MINUS}${k})² dan ${k * k}: hay dos respuestas.`,
      };
    },
    (r) => {
      const a = randomInt(r, 2, 6);
      const b = randomInt(r, 1, 7);
      const c = a * b + randomInt(r, 1, 5);
      return {
        prompt: `${a}(x + ${b}) = ${a}x + ${c}`,
        correct: 'No tiene solución',
        traps: ['x = 0', xEq({ n: c - a * b, d: a }), 'Cualquier número'],
        explain: `Al repartir: ${a}x + ${a * b} = ${a}x + ${c}. Como ${a * b} ≠ ${c}, ningún x sirve.`,
      };
    },
  ],
};

export interface EquationsParams {
  /** Wrong options built from the usual mistakes, explained after each answer. */
  readonly traps?: boolean;
}

export function equationCards(_params: EquationsParams, ctx: GeneratorContext): readonly Card[] {
  const next = { 1: cycle(ctx.random, EQUATIONS[1]), 2: cycle(ctx.random, EQUATIONS[2]), 3: cycle(ctx.random, EQUATIONS[3]) } as const;
  return buildCards(ctx, (level): ChoiceSpec => {
    const made = next[level]()!(ctx.random);
    return {
      level,
      prompt: { text: 'Resuelve', visual: text(made.prompt) },
      correct: text(made.correct),
      distractors: made.traps.map(text),
      options: optionCount(ctx.band, level),
      explain: made.explain,
    };
  });
}

// ---------------------------------------------------------------------------
// Arithmetic and times tables
// ---------------------------------------------------------------------------

export type Operation = 'suma' | 'resta' | 'faltante' | 'multiplicacion';

export interface ArithmeticParams {
  readonly operation: Operation;
  /** Times table to practise (multiplication), e.g. 9. */
  readonly table?: number;
  /** Largest answer, e.g. 10 for answers on the fingers. */
  readonly max?: number;
}

const SKILL: Readonly<Record<Exclude<Operation, 'multiplicacion'>, Skill>> = { suma: 'addition', resta: 'subtraction', faltante: 'missingAddend' };
const ENGINE_LEVEL: Readonly<Record<Level, ArithmeticLevel>> = { 1: 2, 2: 3, 3: 4 };

export function arithmeticCards({ operation, table, max }: ArithmeticParams, ctx: GeneratorContext): readonly Card[] {
  const seed = mixSeed(ctx.idPrefix, operation, table ?? 0, max ?? 0);
  // Each factor once per level before any repeats: 9 × 10 twice in a row is a wasted card.
  const factors = { 1: cycle(ctx.random, [1, 2, 3, 4, 5]), 2: cycle(ctx.random, [6, 7, 8, 9, 10]), 3: cycle(ctx.random, [2, 3, 4, 6, 7, 8, 9, 11, 12]) } as const;
  return buildCards(ctx, (level, index): ChoiceSpec => {
    const options = optionCount(ctx.band, level);
    if (operation === 'multiplicacion') return timesTable(level, table, factors[level]()!, options, ctx.random);
    const question = generateQuestion({ skill: SKILL[operation], level: ENGINE_LEVEL[level], seed, round: index, ...(max ? { maxAnswer: max } : {}) });
    return {
      level,
      prompt: { text: question.prompt },
      correct: text(String(question.answer)),
      distractors: question.options.filter((o) => o !== question.answer).map((o) => text(String(o))),
      options,
      explain: question.prompt.replace('?', String(question.answer)),
    };
  });
}

function timesTable(level: Level, table: number | undefined, k: number, options: number, random: Random): ChoiceSpec {
  const t = table && table >= 1 && table <= 12 ? table : randomInt(random, 2, 9);
  const product = t * k;
  const reversed = Number(String(product).split('').reverse().join(''));
  const candidates = [t * (k + 1), t * (k - 1), t + k, reversed, product + 10, product - 1];
  const seen = new Set([product]);
  const wrong = candidates.filter((x) => x > 0 && !seen.has(x) && (seen.add(x), true));
  return {
    level,
    prompt: { text: `${t} × ${k} = ?` },
    correct: text(String(product)),
    distractors: shuffle(random, wrong.slice(0, 2)).concat(wrong.slice(2)).map((x) => text(String(x))),
    options,
    explain: `${t} × ${k} = ${product}`,
  };
}
