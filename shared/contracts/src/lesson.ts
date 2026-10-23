/**
 * Lessons: the exercise files teachers play on the wall.
 *
 * One small JSON format for every lesson: the starter collection bundled in the teacher app,
 * and the lessons a teacher creates by chatting with the AI. The phone sends the lesson to the
 * TV when a class starts; the TV keeps it in memory only.
 *
 * Pictures are referenced by icon id (Twemoji code points, e.g. "1f438" for a frog), never
 * embedded: a lesson stays a few kilobytes, and the phone sends the TV only the art it needs.
 */
import { allResults, err, flatMapResult, ok, struct, type Result } from './result';

/** School subjects most Latin American curricula share. */
export type Subject = 'matematica' | 'comunicacion' | 'ciencia' | 'personal-social' | 'arte' | 'ingles';
export const SUBJECTS: readonly Subject[] = ['matematica', 'comunicacion', 'ciencia', 'personal-social', 'arte', 'ingles'];

/** Inicial (4–6, pre-readers), primaria (6–12), secundaria (12–16). */
export type AgeBand = 'inicial' | 'primaria' | 'secundaria';
export const AGE_BANDS: readonly AgeBand[] = ['inicial', 'primaria', 'secundaria'];

/** Card difficulty inside a lesson: the TV climbs the levels as children get answers right. */
export type Level = 1 | 2 | 3;
export const LEVELS: readonly Level[] = [1, 2, 3];

/** Twemoji code point sequence, lowercase hex joined by "-", e.g. "1f438" or "1f469-200d-1f3eb". */
export type IconId = string;
const ICON_ID = /^[0-9a-f]{2,6}(-[0-9a-f]{2,6}){0,6}$/;

/** Something shown on the wall: words, one picture, or a group of the same picture to count. */
export type Visual =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'icon'; readonly icon: IconId; readonly label?: string }
  | { readonly kind: 'group'; readonly icon: IconId; readonly count: number };

export interface Prompt {
  /** The question on the wall, e.g. "¿Con qué letra empieza?". */
  readonly text: string;
  /** What the question is about, shown big above the tiles. */
  readonly visual?: Visual;
  /** What the teacher reads aloud for children who cannot read yet. Shown on the phone, not the wall. */
  readonly say?: string;
}

interface CardBase {
  readonly id: string;
  readonly level: Level;
  readonly prompt: Prompt;
  /** One short sentence shown after the answer, e.g. the trap in an equation. */
  readonly explain?: string;
}

export type Card =
  | (CardBase & { readonly kind: 'choice'; readonly options: readonly Visual[]; readonly answer: number })
  | (CardBase & { readonly kind: 'trueFalse'; readonly answer: boolean });

export type CardKind = Card['kind'];
export const CARD_KINDS: readonly CardKind[] = ['choice', 'trueFalse'];

/** A picture per subject, for library tiles and lesson covers. */
export const SUBJECT_ICONS: Readonly<Record<Subject, IconId>> = {
  matematica: '1f522',
  comunicacion: '1f4d6',
  ciencia: '1f52c',
  'personal-social': '1f30e',
  arte: '1f3a8',
  ingles: '1f1ec-1f1e7',
};

/** Icons the TV shows around the game (streaks, stars, records), sent with every lesson's art. */
export const UI_ICONS = { fire: '1f525', star: '2b50', trophy: '1f3c6', speaker: '1f50a', party: '1f389' } as const;

export interface Audience {
  readonly band: AgeBand;
  /** Age in years the teacher asked for, when they said one. */
  readonly age?: number;
}

export type LessonSource = 'starter' | 'ai';

export interface Lesson {
  readonly format: 1;
  readonly id: string;
  readonly title: string;
  readonly subject: Subject;
  readonly audience: Audience;
  readonly source: LessonSource;
  /** The teacher's request this lesson answers, in their own words. */
  readonly request?: string;
  /** ISO 8601 date-time. */
  readonly createdAt: string;
  readonly cards: readonly Card[];
}

export const LESSON_LIMITS = {
  cards: 40,
  options: { min: 2, max: 4 },
  groupCount: 12,
  title: 80,
  prompt: 140,
  option: 48,
  say: 160,
  explain: 220,
  request: 400,
} as const;

// ---------------------------------------------------------------------------
// Decoding: unknown JSON → Lesson, or the first problem found (never throws)
// ---------------------------------------------------------------------------

type Json = Readonly<Record<string, unknown>>;
type Decoder<T> = (value: unknown, path: string) => Result<T>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

const text =
  (max: number): Decoder<string> =>
  (value, path) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max ? ok(value) : err(`${path} must be text of 1–${max} characters`);

const integer =
  (min: number, max: number): Decoder<number> =>
  (value, path) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? ok(value) : err(`${path} must be a whole number from ${min} to ${max}`);

const oneOf =
  <T extends string | number>(values: readonly T[]): Decoder<T> =>
  (value, path) =>
    (values as readonly unknown[]).includes(value) ? ok(value as T) : err(`${path} must be one of ${values.join(', ')}`);

const optional =
  <T>(decode: Decoder<T>): Decoder<T | undefined> =>
  (value, path) =>
    value === undefined ? ok(undefined) : decode(value, path);

const iconId: Decoder<IconId> = (value, path) => (typeof value === 'string' && ICON_ID.test(value) ? ok(value) : err(`${path} must be an icon id such as "1f438"`));

const array =
  <T>(decode: Decoder<T>, min: number, max: number): Decoder<readonly T[]> =>
  (value, path) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) return err(`${path} must be a list of ${min}–${max} items`);
    return allResults(value.map((item, i) => decode(item, `${path}[${i}]`)));
  };

const record =
  <T>(decode: (o: Json, path: string) => Result<T>): Decoder<T> =>
  (value, path) =>
    isRecord(value) ? decode(value, path) : err(`${path} must be an object`);

export const decodeVisual: Decoder<Visual> = record((v, path): Result<Visual> => {
  switch (v.kind) {
    case 'text':
      return struct({ kind: ok('text' as const), text: text(LESSON_LIMITS.option)(v.text, `${path}.text`) });
    case 'icon':
      return struct({ kind: ok('icon' as const), icon: iconId(v.icon, `${path}.icon`), label: optional(text(LESSON_LIMITS.option))(v.label, `${path}.label`) });
    case 'group':
      return struct({ kind: ok('group' as const), icon: iconId(v.icon, `${path}.icon`), count: integer(1, LESSON_LIMITS.groupCount)(v.count, `${path}.count`) });
    default:
      return err(`${path}.kind must be text, icon or group`);
  }
});

const decodePrompt: Decoder<Prompt> = record((p, path) =>
  struct({
    text: text(LESSON_LIMITS.prompt)(p.text, `${path}.text`),
    visual: optional(decodeVisual)(p.visual, `${path}.visual`),
    say: optional(text(LESSON_LIMITS.say))(p.say, `${path}.say`),
  }),
);

export const decodeCard: Decoder<Card> = record((c, path): Result<Card> => {
  const base = {
    id: text(40)(c.id, `${path}.id`),
    level: oneOf(LEVELS)(c.level, `${path}.level`),
    prompt: decodePrompt(c.prompt, `${path}.prompt`),
    explain: optional(text(LESSON_LIMITS.explain))(c.explain, `${path}.explain`),
  };
  switch (c.kind) {
    case 'choice':
      return struct({
        kind: ok('choice' as const),
        ...base,
        options: array(decodeVisual, LESSON_LIMITS.options.min, LESSON_LIMITS.options.max)(c.options, `${path}.options`),
        answer: integer(0, LESSON_LIMITS.options.max - 1)(c.answer, `${path}.answer`),
      });
    case 'trueFalse':
      return struct({
        kind: ok('trueFalse' as const),
        ...base,
        answer: typeof c.answer === 'boolean' ? ok(c.answer) : err(`${path}.answer must be true or false`),
      });
    default:
      return err(`${path}.kind must be choice or trueFalse`);
  }
});

const decodeAudience: Decoder<Audience> = record((a, path) =>
  struct({ band: oneOf(AGE_BANDS)(a.band, `${path}.band`), age: optional(integer(3, 18))(a.age, `${path}.age`) }),
);

const isoDate: Decoder<string> = (value, path) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? ok(value) : err(`${path} must be an ISO date`);

const decodeLessonShape: Decoder<Lesson> = record((l, path) =>
  struct({
    format: oneOf([1] as const)(l.format, `${path}.format`),
    id: text(60)(l.id, `${path}.id`),
    title: text(LESSON_LIMITS.title)(l.title, `${path}.title`),
    subject: oneOf(SUBJECTS)(l.subject, `${path}.subject`),
    audience: decodeAudience(l.audience, `${path}.audience`),
    source: oneOf(['starter', 'ai'] as const)(l.source, `${path}.source`),
    request: optional(text(LESSON_LIMITS.request))(l.request, `${path}.request`),
    createdAt: isoDate(l.createdAt, `${path}.createdAt`),
    cards: array(decodeCard, 1, LESSON_LIMITS.cards)(l.cards, `${path}.cards`),
  }),
);

// ---------------------------------------------------------------------------
// Rules a well-formed lesson must also follow
// ---------------------------------------------------------------------------

/** Two options are the same if children would see the same thing. */
export function visualKey(visual: Visual): string {
  switch (visual.kind) {
    case 'text':
      return `t:${visual.text.trim().toLowerCase()}`;
    case 'icon':
      return `i:${visual.icon}`;
    case 'group':
      return `g:${visual.icon}:${visual.count}`;
  }
}

/** Problems that make a card unplayable or unfair, e.g. two identical tiles or no right answer. */
export function cardProblems(card: Card): readonly string[] {
  if (card.kind === 'trueFalse') return [];
  const problems: string[] = [];
  if (card.answer >= card.options.length) problems.push(`card ${card.id}: the answer points at a missing option`);
  const keys = card.options.map(visualKey);
  if (new Set(keys).size !== keys.length) problems.push(`card ${card.id}: two options look the same`);
  return problems;
}

export function lessonProblems(lesson: Lesson): readonly string[] {
  const ids = lesson.cards.map((c) => c.id);
  const duplicateIds = ids.length !== new Set(ids).size ? ['two cards share an id'] : [];
  return [...duplicateIds, ...lesson.cards.flatMap(cardProblems)];
}

/** Reads a lesson from untrusted JSON (a file, the AI, the wire). Never throws. */
export const decodeLesson = (value: unknown): Result<Lesson> =>
  flatMapResult(decodeLessonShape(value, 'lesson'), (lesson) => {
    const problems = lessonProblems(lesson);
    return problems.length === 0 ? ok(lesson) : err(problems.join('; '));
  });

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

const iconsOfVisual = (visual: Visual | undefined): readonly IconId[] => (visual && visual.kind !== 'text' ? [visual.icon] : []);

/** Every icon a lesson shows, once each: what the phone must send the TV with it. */
export function iconsOf(lesson: Lesson): readonly IconId[] {
  const icons = lesson.cards.flatMap((card) => [...iconsOfVisual(card.prompt.visual), ...(card.kind === 'choice' ? card.options.flatMap(iconsOfVisual) : [])]);
  return [...new Set(icons)];
}

export const cardsAt = (lesson: Lesson, level: Level): readonly Card[] => lesson.cards.filter((c) => c.level === level);

/** A one-line text version of a visual, for the phone's live view and for logs. */
export function visualText(visual: Visual): string {
  switch (visual.kind) {
    case 'text':
      return visual.text;
    case 'icon':
      return visual.label ?? `[${visual.icon}]`;
    case 'group':
      return `${visual.count} × [${visual.icon}]`;
  }
}

/** The right answer, as words, e.g. "7" or "VERDADERO". */
export const answerText = (card: Card): string =>
  card.kind === 'trueFalse' ? (card.answer ? 'VERDADERO' : 'FALSO') : card.options[card.answer] ? visualText(card.options[card.answer]!) : '?';
