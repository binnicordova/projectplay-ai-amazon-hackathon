/**
 * What the AI answers, and how an answer becomes a lesson.
 *
 * The AI never writes the answer key for exercises the engine knows (numbers, letters,
 * syllables, fractions, equations…): it only fills an exercise request, and the engine builds
 * the cards. For other topics (science, history, art…) the AI writes the cards itself; they are
 * checked like any lesson file and the teacher reviews them before saving.
 */
import {
  AGE_BANDS,
  SUBJECTS,
  decodeLesson,
  err,
  flatMapResult,
  ok,
  type AgeBand,
  type Card,
  type Lesson,
  type Level,
  type Result,
  type Subject,
  type Visual,
} from '@mimikai/contracts';
import { EXERCISE_KINDS, TAGS, findWord, generateCards, mixSeed, mulberry32, shuffle, type ExerciseRequest, type Tag } from '@mimikai/exercise-engine';

/** A card the AI writes for a topic the engine does not cover. Pictures are named by word. */
export type AiCard =
  | {
      readonly kind: 'choice';
      readonly level?: Level;
      readonly question: string;
      readonly picture?: string;
      readonly say?: string;
      readonly options: readonly string[];
      /** Options are words with a picture (inicial: children cannot read yet). */
      readonly pictures?: boolean;
      readonly answer: number;
      readonly explain?: string;
    }
  | { readonly kind: 'trueFalse'; readonly level?: Level; readonly statement: string; readonly picture?: string; readonly say?: string; readonly answer: boolean; readonly explain?: string };

export interface DraftSpec {
  readonly title: string;
  readonly subject: Subject;
  readonly band: AgeBand;
  readonly age?: number;
  readonly count: number;
  readonly exercises: { readonly kind: 'generator'; readonly request: ExerciseRequest } | { readonly kind: 'cards'; readonly cards: readonly AiCard[] };
}

export interface AiReply {
  /** What the assistant says to the teacher (one or two sentences). */
  readonly reply: string;
  /** The lesson, or null when the teacher only asked something. */
  readonly lesson: DraftSpec | null;
}

// ---------------------------------------------------------------------------
// Decoding the AI's JSON (untrusted): never throws
// ---------------------------------------------------------------------------

type Json = Readonly<Record<string, unknown>>;
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : undefined);
const int = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;
const level = (v: unknown): Level | undefined => int(v, 1, 3) as Level | undefined;
const oneOf = <T extends string>(values: readonly T[], v: unknown): T | undefined => (values as readonly unknown[]).includes(v) ? (v as T) : undefined;
const optional = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } => (value === undefined ? {} : ({ [key]: value } as { [P in K]?: V }));

const letter = (v: unknown): string | undefined => (typeof v === 'string' && /^[a-zñ]$/i.test(v.trim()) ? v.trim().toLowerCase() : undefined);
const syllable = (v: unknown): string | undefined => (typeof v === 'string' && /^[a-záéíóúüñ]{1,4}$/i.test(v.trim()) ? v.trim().toUpperCase() : undefined);
const tag = (v: unknown): Tag | undefined => oneOf(TAGS, v);

/** The exercise request inside a reply, with every parameter clamped to what the engine supports. */
export function decodeExerciseRequest(v: unknown): Result<ExerciseRequest> {
  if (!isRecord(v)) return err('generator must be an object');
  const kind = oneOf(EXERCISE_KINDS, v.kind);
  switch (kind) {
    case 'numbers': {
      const from = int(v.from, 0, 20) ?? 1;
      const to = int(v.to, 1, 20) ?? 10;
      return ok({ kind, from: Math.min(from, to), to: Math.max(from, to) });
    }
    case 'compare':
      return ok({ kind, max: int(v.max, 4, 12) ?? 10 });
    case 'letters':
      return ok({ kind, ...optional('from', letter(v.from)), ...optional('to', letter(v.to)), ...optional('theme', tag(v.theme)), ...optional('uppercase', typeof v.uppercase === 'boolean' ? v.uppercase : undefined) });
    case 'syllableSounds':
      return ok({ kind, ...optional('theme', tag(v.theme)) });
    case 'syllables': {
      const list = Array.isArray(v.syllables) ? v.syllables.map(syllable).filter((s): s is string => s !== undefined).slice(0, 6) : [];
      return list.length > 0 ? ok({ kind, syllables: list }) : err('syllables must list one to six syllables');
    }
    case 'soundPractice': {
      const sound = syllable(v.sound);
      return sound ? ok({ kind, sound }) : err('sound must be a syllable such as "RO"');
    }
    case 'completeSentence':
      return ok({ kind });
    case 'english':
      return ok({ kind, ...optional('theme', tag(v.theme)) });
    case 'fractions':
      return ok({ kind, big: v.big !== false });
    case 'equations':
      return ok({ kind, traps: v.traps !== false });
    case 'arithmetic': {
      const operation = oneOf(['suma', 'resta', 'faltante', 'multiplicacion'] as const, v.operation);
      if (!operation) return err('operation must be suma, resta, faltante or multiplicacion');
      return ok({ kind, operation, ...optional('table', int(v.table, 1, 12)), ...optional('max', int(v.max, 5, 100)) });
    }
    default:
      return err(`generator.kind must be one of ${EXERCISE_KINDS.join(', ')}`);
  }
}

function decodeAiCard(v: unknown, index: number): Result<AiCard> {
  if (!isRecord(v)) return err(`cards[${index}] must be an object`);
  const common = { ...optional('level', level(v.level)), ...optional('picture', str(v.picture, 30)), ...optional('say', str(v.say, 160)), ...optional('explain', str(v.explain, 220)) };
  if (typeof v.statement === 'string') {
    const statement = str(v.statement, 140);
    if (!statement || typeof v.answer !== 'boolean') return err(`cards[${index}] needs a statement and a true/false answer`);
    return ok({ kind: 'trueFalse', statement, answer: v.answer, ...common });
  }
  const question = str(v.question, 140);
  const options = Array.isArray(v.options) ? v.options.map((o) => str(o, 48)).filter((o): o is string => o !== undefined) : [];
  const answer = typeof v.answer === 'number' && Number.isInteger(v.answer) ? v.answer : -1;
  if (!question || options.length < 2 || options.length > 4 || answer < 0 || answer >= options.length) {
    return err(`cards[${index}] needs a question, 2–4 options and the index of the right one`);
  }
  return ok({ kind: 'choice', question, options, answer, ...optional('pictures', v.pictures === true ? true : undefined), ...common });
}

function decodeDraft(v: unknown): Result<DraftSpec> {
  if (!isRecord(v)) return err('lesson must be an object or null');
  const title = str(v.title, 80);
  const subject = oneOf(SUBJECTS, v.subject);
  const band = oneOf(AGE_BANDS, v.band);
  if (!title || !subject || !band) return err('lesson needs a title, a subject and a band');
  const base = { title, subject, band, ...optional('age', int(v.age, 3, 18)), count: int(v.count, 1, 40) ?? 10 };
  if (v.generator !== undefined && v.generator !== null) {
    return flatMapResult(decodeExerciseRequest(v.generator), (request) => ok({ ...base, exercises: { kind: 'generator' as const, request } }));
  }
  if (!Array.isArray(v.cards) || v.cards.length === 0) return err('lesson needs a generator or a list of cards');
  const cards: AiCard[] = [];
  for (const [i, raw] of v.cards.slice(0, 40).entries()) {
    const card = decodeAiCard(raw, i);
    if (!card.ok) return card;
    cards.push(card.value);
  }
  return ok({ ...base, count: cards.length, exercises: { kind: 'cards', cards } });
}

/** Reads the AI's answer. Anything that is not the agreed JSON is an error the AI is asked to fix. */
export function decodeAiReply(text: string): Result<AiReply> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err('the answer is not valid JSON');
  }
  if (!isRecord(parsed)) return err('the answer must be a JSON object');
  const reply = str(parsed.reply, 600) ?? '';
  if (parsed.lesson === undefined || parsed.lesson === null) return reply ? ok({ reply, lesson: null }) : err('reply must be a short message');
  return flatMapResult(decodeDraft(parsed.lesson), (lesson) => ok({ reply: reply || 'Listo.', lesson }));
}

// ---------------------------------------------------------------------------
// Draft → lesson
// ---------------------------------------------------------------------------

const MAX_OPTIONS: Readonly<Record<AgeBand, number>> = { inicial: 3, primaria: 4, secundaria: 4 };

/** A word the app has a picture for, as a picture tile; any other word stays text. */
function pictureOrText(word: string, wantPicture: boolean): Visual {
  const found = wantPicture ? findWord(word) : undefined;
  return found ? { kind: 'icon', icon: found.icon, label: found.es } : { kind: 'text', text: word };
}

/** Levels the AI left out climb with the card's position: first third easy, last third hard. */
const levelByPosition = (index: number, total: number): Level => (index < Math.ceil(total / 3) ? 1 : index < Math.ceil((2 * total) / 3) ? 2 : 3);

function toCard(card: AiCard, index: number, total: number, id: string, band: AgeBand, seed: number): Card {
  const picture = card.picture ? findWord(card.picture) : undefined;
  const visual = picture ? { visual: { kind: 'icon' as const, icon: picture.icon, label: picture.es } } : {};
  const base = { id, level: card.level ?? levelByPosition(index, total), ...(card.explain ? { explain: card.explain } : {}) };
  if (card.kind === 'trueFalse') {
    return { kind: 'trueFalse', ...base, prompt: { text: card.statement, ...visual, ...(card.say ? { say: card.say } : {}) }, answer: card.answer };
  }
  // Pre-readers get at most three tiles: keep the right one and the first wrong ones. Then shuffle:
  // models tend to put the right answer first, and children notice patterns fast.
  const all = card.options.map((text, i) => ({ text, i }));
  const wrong = all.filter(({ i }) => i !== card.answer).slice(0, MAX_OPTIONS[band] - 1);
  const options = shuffle(mulberry32(mixSeed(seed, id)), [all[card.answer]!, ...wrong]);
  const allPictures = (card.pictures === true || band === 'inicial') && options.every(({ text }) => findWord(text) !== undefined);
  return {
    kind: 'choice',
    ...base,
    prompt: { text: card.question, ...visual, ...(card.say ? { say: card.say } : {}) },
    options: options.map(({ text }) => pictureOrText(text, allPictures)),
    answer: options.findIndex(({ i }) => i === card.answer),
  };
}

export interface LessonContext {
  readonly id: string;
  /** ISO date-time. */
  readonly createdAt: string;
  readonly seed: number;
  /** The teacher's request, in their words. */
  readonly request: string;
}

/** Builds and checks the lesson. Errors are explained so the AI can be asked to fix them. */
export function lessonFromDraft(draft: DraftSpec, context: LessonContext): Result<Lesson> {
  const cards =
    draft.exercises.kind === 'generator'
      ? generateCards(draft.exercises.request, { band: draft.band, count: draft.count, seed: context.seed, idPrefix: `${context.id}-` })
      : draft.exercises.cards.map((card, i, all) => toCard(card, i, all.length, `${context.id}-${i + 1}`, draft.band, context.seed));
  if (cards.length === 0) return err('the engine could not build any card for that request: choose another generator or write the cards');
  return decodeLesson({
    format: 1,
    id: context.id,
    title: draft.title,
    subject: draft.subject,
    audience: draft.age === undefined ? { band: draft.band } : { band: draft.band, age: draft.age },
    source: 'ai',
    request: context.request.slice(0, 400),
    createdAt: context.createdAt,
    cards,
  });
}
