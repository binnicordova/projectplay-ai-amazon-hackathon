/**
 * LessonStore adapter: one JSON file per lesson in the app's document folder, plus one file
 * for the records. Lessons are a few kilobytes each, so plain files are plenty.
 */
import { err, ok, type Lesson, type Result } from '@mimikai/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import type { Records } from '../domain/catalog';
import type { LessonStore } from '../application/ports';

const folder = () => new Directory(Paths.document, 'lessons');
const recordsFile = () => new File(Paths.document, 'records.json');
/** Lesson ids become file names: keep them to safe characters. */
const fileFor = (lessonId: string) => new File(folder(), `${lessonId.replace(/[^a-z0-9-]/gi, '_')}.json`);

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function attempt<T>(work: () => Promise<T> | T): Promise<Result<T>> {
  try {
    return ok(await work());
  } catch (error) {
    return err(reason(error));
  }
}

export const fileLessonStore: LessonStore = {
  listFiles: () =>
    attempt(async () => {
      const dir = folder();
      if (!dir.exists) return [];
      const files = dir.list().filter((entry): entry is File => entry instanceof File && entry.name.endsWith('.json'));
      const texts = await Promise.all(files.map((file) => file.text()));
      return texts.flatMap((text): unknown[] => {
        try {
          return [JSON.parse(text) as unknown];
        } catch {
          return [{ unreadable: true }];
        }
      });
    }),
  save: (lesson: Lesson) =>
    attempt(() => {
      folder().create({ intermediates: true, idempotent: true });
      const file = fileFor(lesson.id);
      if (!file.exists) file.create();
      file.write(JSON.stringify(lesson));
    }),
  remove: (lessonId) =>
    attempt(() => {
      const file = fileFor(lessonId);
      if (file.exists) file.delete();
    }),
  loadRecords: async () => {
    const result = await attempt(async () => {
      const file = recordsFile();
      return file.exists ? (JSON.parse(await file.text()) as unknown) : {};
    });
    if (!result.ok || typeof result.value !== 'object' || result.value === null) return {};
    return Object.fromEntries(Object.entries(result.value).filter((e): e is [string, number] => typeof e[1] === 'number'));
  },
  saveRecords: async (records: Records) => {
    await attempt(() => {
      const file = recordsFile();
      if (!file.exists) file.create();
      file.write(JSON.stringify(records));
    });
  },
};
