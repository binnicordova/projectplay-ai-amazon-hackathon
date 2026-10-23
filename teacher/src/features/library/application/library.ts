/**
 * Library use cases: load the starter collection and the teacher's lessons, save and delete
 * lessons, choose what to play, and keep the best score of each lesson.
 */
import { decodeLesson, type AgeBand, type Lesson, type Result, type Subject, type TeamCount } from '@projectplay/contracts';
import { atom, type createStore } from 'jotai';
import { mergeLibrary, withScore, type Records } from '../domain/catalog';
import type { LessonStore } from './ports';

type Store = ReturnType<typeof createStore>;

export const starterLessonsAtom = atom<readonly Lesson[]>([]);
export const savedLessonsAtom = atom<readonly Lesson[]>([]);
export const recordsAtom = atom<Records>({});
/** Lesson files that could not be read (a damaged file), with the reason, so they are not silently lost. */
export const unreadableLessonsAtom = atom<readonly string[]>([]);

export const lessonsAtom = atom((get) => mergeLibrary(get(starterLessonsAtom), get(savedLessonsAtom)));

export const subjectFilterAtom = atom<Subject | null>(null);
export const bandFilterAtom = atom<AgeBand | null>(null);

export const selectedLessonIdAtom = atom<string | null>(null);
export const selectedLessonAtom = atom((get) => {
  const id = get(selectedLessonIdAtom);
  return get(lessonsAtom).find((l) => l.id === id) ?? null;
});

export interface Library {
  readonly load: () => Promise<void>;
  readonly save: (lesson: Lesson) => Promise<Result<void>>;
  readonly remove: (lessonId: string) => Promise<Result<void>>;
  readonly choose: (lessonId: string) => void;
  readonly recordScore: (lessonId: string, teams: TeamCount, score: number) => Promise<void>;
}

function decodeAll(files: readonly unknown[]): { readonly lessons: readonly Lesson[]; readonly problems: readonly string[] } {
  const results = files.map((file) => decodeLesson(file));
  return {
    lessons: results.flatMap((r) => (r.ok ? [r.value] : [])),
    problems: results.flatMap((r) => (r.ok ? [] : [r.error])),
  };
}

export function makeLibrary(deps: { readonly store: Store; readonly files: LessonStore; readonly starterFiles: readonly unknown[] }): Library {
  const { store, files } = deps;
  return {
    load: async () => {
      const starter = decodeAll(deps.starterFiles);
      store.set(starterLessonsAtom, starter.lessons);
      const saved = await files.listFiles();
      const own = saved.ok ? decodeAll(saved.value) : { lessons: [], problems: [saved.error] };
      store.set(savedLessonsAtom, own.lessons);
      store.set(unreadableLessonsAtom, [...starter.problems, ...own.problems]);
      store.set(recordsAtom, await files.loadRecords());
      if (store.get(selectedLessonIdAtom) === null) store.set(selectedLessonIdAtom, store.get(lessonsAtom)[0]?.id ?? null);
    },
    save: async (lesson) => {
      const result = await files.save(lesson);
      if (result.ok) store.set(savedLessonsAtom, (lessons) => [lesson, ...lessons.filter((l) => l.id !== lesson.id)]);
      return result;
    },
    remove: async (lessonId) => {
      const result = await files.remove(lessonId);
      if (result.ok) {
        store.set(savedLessonsAtom, (lessons) => lessons.filter((l) => l.id !== lessonId));
        if (store.get(selectedLessonIdAtom) === lessonId) store.set(selectedLessonIdAtom, store.get(lessonsAtom)[0]?.id ?? null);
      }
      return result;
    },
    choose: (lessonId) => store.set(selectedLessonIdAtom, lessonId),
    recordScore: async (lessonId, teams, score) => {
      const before = store.get(recordsAtom);
      const after = withScore(before, lessonId, teams, score);
      if (after === before) return;
      store.set(recordsAtom, after);
      await files.saveRecords(after);
    },
  };
}
