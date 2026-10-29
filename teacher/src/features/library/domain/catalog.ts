/**
 * The teacher's library: the starter collection plus the lessons they created, grouped by
 * subject, with the best score each lesson has seen. Pure functions over read-only data.
 */
import { LEVELS, SUBJECTS, SUBJECT_ICONS, type AgeBand, type IconId, type Lesson, type Level, type Subject, type TeamCount } from '@mimikai/contracts';

export interface SubjectInfo {
  readonly label: string;
  /** Tile colour on the phone. */
  readonly color: string;
  /** Twemoji picture for the subject tile. */
  readonly icon: IconId;
}

export const SUBJECT_INFO: Readonly<Record<Subject, SubjectInfo>> = {
  matematica: { label: 'Matemática', color: '#3D7BFF', icon: SUBJECT_ICONS.matematica },
  comunicacion: { label: 'Comunicación', color: '#A855F7', icon: SUBJECT_ICONS.comunicacion },
  ciencia: { label: 'Ciencia y Tecnología', color: '#22B07D', icon: SUBJECT_ICONS.ciencia },
  'personal-social': { label: 'Personal Social', color: '#F97316', icon: SUBJECT_ICONS['personal-social'] },
  arte: { label: 'Arte y Cultura', color: '#EC4899', icon: SUBJECT_ICONS.arte },
  ingles: { label: 'Inglés', color: '#0EA5E9', icon: SUBJECT_ICONS.ingles },
};

export const BAND_LABELS: Readonly<Record<AgeBand, string>> = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' };

export const audienceLabel = (lesson: Lesson): string =>
  lesson.audience.age === undefined ? BAND_LABELS[lesson.audience.band] : `${BAND_LABELS[lesson.audience.band]} · ${lesson.audience.age} años`;

/** Best score per lesson and team count ("silabas-ma-pa-ro:2" → 840), kept on the phone only. */
export type Records = Readonly<Record<string, number>>;

export const recordKey = (lessonId: string, teams: TeamCount): string => `${lessonId}:${teams}`;

export const recordOf = (records: Records, lessonId: string, teams: TeamCount): number | undefined => records[recordKey(lessonId, teams)];

/** The records after a class: a new best replaces the old one, anything else changes nothing. */
export function withScore(records: Records, lessonId: string, teams: TeamCount, score: number): Records {
  const key = recordKey(lessonId, teams);
  return score > (records[key] ?? 0) ? { ...records, [key]: score } : records;
}

/**
 * Starter lessons first, then the teacher's own (newest first). A saved lesson with a starter's
 * id never hides the starter: ids of created lessons are unique anyway.
 */
export function mergeLibrary(starter: readonly Lesson[], saved: readonly Lesson[]): readonly Lesson[] {
  const starterIds = new Set(starter.map((l) => l.id));
  const own = saved.filter((l) => !starterIds.has(l.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...own, ...starter];
}

export const lessonsIn = (lessons: readonly Lesson[], subject: Subject | null, band: AgeBand | null): readonly Lesson[] =>
  lessons.filter((l) => (subject === null || l.subject === subject) && (band === null || l.audience.band === band));

export const countBySubject = (lessons: readonly Lesson[]): Readonly<Record<Subject, number>> =>
  Object.fromEntries(SUBJECTS.map((s) => [s, lessons.filter((l) => l.subject === s).length])) as Record<Subject, number>;

export const levelCounts = (lesson: Lesson): Readonly<Record<Level, number>> =>
  Object.fromEntries(LEVELS.map((level) => [level, lesson.cards.filter((c) => c.level === level).length])) as Record<Level, number>;

/** A lesson's cover picture: the first picture it shows, or its subject's icon. */
export function coverIcon(lesson: Lesson): IconId {
  for (const card of lesson.cards) {
    const visuals = [card.prompt.visual, ...(card.kind === 'choice' ? card.options : [])];
    const picture = visuals.find((v) => v && v.kind !== 'text');
    if (picture && picture.kind !== 'text') return picture.icon;
  }
  return SUBJECT_INFO[lesson.subject].icon;
}

/** How many cards to play: what the class has time for, never more than the lesson has. */
export const ROUND_CHOICES = [5, 10, 15] as const;
export const roundsFor = (lesson: Lesson, wanted: number): number => Math.max(1, Math.min(wanted, lesson.cards.length));
