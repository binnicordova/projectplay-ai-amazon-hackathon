/**
 * The teacher's journey with Mimi, the class pet. Gamification for the adult in the room, built
 * on the same picture the children see on the wall: Mimi juggles more rings as it plays more
 * classes, keeps a streak of school days, and unlocks achievements that are about the class,
 * never about speed or money.
 *
 * Pure data in, data out: the phone keeps this in one small file and nothing leaves the device.
 */
import type { Level } from '@mimikai/contracts';

/** A calendar day on the phone, `YYYY-MM-DD` (local time). */
export type Day = string;

export type AchievementId = 'firstClass' | 'firstLesson' | 'perfectClass' | 'level3' | 'streak5' | 'classes10' | 'answers100';

export interface MimiProgress {
  /** Classes played to the end. */
  readonly classes: number;
  /** Right answers across every class (both teams). */
  readonly rightAnswers: number;
  /** Lessons created and saved with Crea con Mimi. */
  readonly lessonsCreated: number;
  readonly perfectClasses: number;
  /** The hardest level a class has reached. */
  readonly topLevel: Level;
  /** Days with a class, oldest first (the last few months only). */
  readonly days: readonly Day[];
  readonly bestStreak: number;
  /** In the order they were unlocked. */
  readonly achievements: readonly AchievementId[];
}

export const NO_PROGRESS: MimiProgress = {
  classes: 0,
  rightAnswers: 0,
  lessonsCreated: 0,
  perfectClasses: 0,
  topLevel: 1,
  days: [],
  bestStreak: 0,
  achievements: [],
};

export interface FinishedClass {
  readonly day: Day;
  /** Cards played. */
  readonly rounds: number;
  /** Teams on the wall (1 or 2). */
  readonly teams: number;
  /** Right answers, both teams together. */
  readonly correct: number;
  readonly level: Level;
}

export type MimiEvent = { readonly type: 'classFinished'; readonly finished: FinishedClass } | { readonly type: 'lessonCreated'; readonly day: Day };

/** Enough days for any streak worth showing, without the file growing forever. */
const KEEP_DAYS = 120;

// ---------------------------------------------------------------------------
// Days and the streak
// ---------------------------------------------------------------------------

const dateOf = (day: Day): Date => new Date(`${day}T12:00:00Z`);
const dayOf = (date: Date): Day => date.toISOString().slice(0, 10);
const isWeekend = (day: Day): boolean => [0, 6].includes(dateOf(day).getUTCDay());

/** The school day before `day` (Friday before a Monday). */
export function previousSchoolDay(day: Day): Day {
  const date = dateOf(day);
  do date.setUTCDate(date.getUTCDate() - 1);
  while (isWeekend(dayOf(date)));
  return dayOf(date);
}

/**
 * School days in a row with a class, up to today. Weekends never break it, and today without a
 * class yet doesn't either: the streak is still alive until today ends.
 */
export function streakOf(days: readonly Day[], today: Day): number {
  const played = new Set(days);
  let day = played.has(today) || isWeekend(today) ? today : previousSchoolDay(today);
  if (isWeekend(day)) day = previousSchoolDay(day);
  let streak = 0;
  while (played.has(day)) {
    streak++;
    day = previousSchoolDay(day);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Rings: Mimi juggles more as it plays more classes
// ---------------------------------------------------------------------------

/** Classes needed for each ring: the 2nd ring after 3 classes, the 5th after 25. */
export const RING_AT: readonly number[] = [0, 3, 8, 15, 25];

export const ringsOf = (progress: MimiProgress): number => RING_AT.filter((at) => progress.classes >= at).length;

/** Classes left until the next ring, or null with all five. */
export function nextRingIn(progress: MimiProgress): number | null {
  const next = RING_AT.find((at) => at > progress.classes);
  return next === undefined ? null : next - progress.classes;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface Achievement {
  readonly id: AchievementId;
  readonly title: string;
  readonly detail: string;
  /** Twemoji code point. */
  readonly icon: string;
  readonly unlocked: (progress: MimiProgress) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'firstClass', title: 'Primera clase', detail: 'Jugaste tu primera clase con Mimi', icon: '1f389', unlocked: (p) => p.classes >= 1 },
  { id: 'firstLesson', title: 'Primera lección', detail: 'Creaste una lección con Mimi', icon: '2728', unlocked: (p) => p.lessonsCreated >= 1 },
  { id: 'perfectClass', title: 'Clase perfecta', detail: 'Todas las respuestas correctas', icon: '2b50', unlocked: (p) => p.perfectClasses >= 1 },
  { id: 'level3', title: 'Nivel 3', detail: 'Una clase llegó al nivel más difícil', icon: '1f680', unlocked: (p) => p.topLevel >= 3 },
  { id: 'streak5', title: '5 días seguidos', detail: 'Cinco días de clase seguidos con Mimi', icon: '1f525', unlocked: (p) => p.bestStreak >= 5 },
  { id: 'classes10', title: '10 clases', detail: 'Diez clases jugadas con Mimi', icon: '1f3c6', unlocked: (p) => p.classes >= 10 },
  { id: 'answers100', title: '100 aciertos', detail: 'Cien respuestas correctas de tus alumnos', icon: '1f4af', unlocked: (p) => p.rightAnswers >= 100 },
];

export const achievementOf = (id: AchievementId): Achievement => ACHIEVEMENTS.find((a) => a.id === id)!;

function withAchievements(progress: MimiProgress): MimiProgress {
  const fresh = ACHIEVEMENTS.filter((a) => !progress.achievements.includes(a.id) && a.unlocked(progress)).map((a) => a.id);
  return fresh.length === 0 ? progress : { ...progress, achievements: [...progress.achievements, ...fresh] };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function reduceProgress(progress: MimiProgress, event: MimiEvent): MimiProgress {
  switch (event.type) {
    case 'classFinished': {
      const { day, rounds, teams, correct, level } = event.finished;
      // A class ended before its first card counts for nothing.
      if (rounds < 1) return progress;
      const days = progress.days.includes(day) ? progress.days : [...progress.days, day].sort().slice(-KEEP_DAYS);
      return withAchievements({
        ...progress,
        classes: progress.classes + 1,
        rightAnswers: progress.rightAnswers + correct,
        perfectClasses: progress.perfectClasses + (correct >= rounds * teams ? 1 : 0),
        topLevel: Math.max(progress.topLevel, level) as Level,
        days,
        bestStreak: Math.max(progress.bestStreak, streakOf(days, day)),
      });
    }
    case 'lessonCreated':
      return withAchievements({ ...progress, lessonsCreated: progress.lessonsCreated + 1 });
  }
}

// ---------------------------------------------------------------------------
// Moments: what Mimi celebrates full screen after an event
// ---------------------------------------------------------------------------

export type MimiMoment =
  | { readonly kind: 'classDone'; readonly correct: number; readonly asked: number; readonly streak: number }
  | { readonly kind: 'ring'; readonly rings: number }
  | { readonly kind: 'achievement'; readonly id: AchievementId };

/** The celebrations an event earned, in the order Mimi shows them. */
export function momentsOf(before: MimiProgress, after: MimiProgress, event: MimiEvent): readonly MimiMoment[] {
  if (before === after) return [];
  const done: MimiMoment[] =
    event.type === 'classFinished'
      ? [{ kind: 'classDone', correct: event.finished.correct, asked: event.finished.rounds * event.finished.teams, streak: streakOf(after.days, event.finished.day) }]
      : [];
  const ring: MimiMoment[] = ringsOf(after) > ringsOf(before) ? [{ kind: 'ring', rings: ringsOf(after) }] : [];
  const unlocked = after.achievements.filter((id) => !before.achievements.includes(id)).map((id): MimiMoment => ({ kind: 'achievement', id }));
  return [...done, ...ring, ...unlocked];
}

/** Decodes the saved file; anything unreadable starts the journey again rather than crashing. */
export function decodeProgress(value: unknown): MimiProgress {
  if (typeof value !== 'object' || value === null) return NO_PROGRESS;
  const o = value as Record<string, unknown>;
  const count = (key: string) => (typeof o[key] === 'number' && Number.isFinite(o[key]) && (o[key] as number) >= 0 ? Math.floor(o[key] as number) : 0);
  const level = count('topLevel');
  const days = Array.isArray(o.days) ? o.days.filter((d): d is Day => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  const ids = new Set<string>(ACHIEVEMENTS.map((a) => a.id));
  const achievements = Array.isArray(o.achievements) ? o.achievements.filter((id): id is AchievementId => typeof id === 'string' && ids.has(id)) : [];
  return {
    classes: count('classes'),
    rightAnswers: count('rightAnswers'),
    lessonsCreated: count('lessonsCreated'),
    perfectClasses: count('perfectClasses'),
    topLevel: (level >= 1 && level <= 3 ? level : 1) as Level,
    days: [...new Set(days)].sort().slice(-KEEP_DAYS),
    bestStreak: count('bestStreak'),
    achievements: [...new Set(achievements)],
  };
}
