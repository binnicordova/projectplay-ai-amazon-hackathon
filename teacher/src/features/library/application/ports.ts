import type { Lesson, Result } from '@mimikai/contracts';
import type { Records } from '../domain/catalog';

/** Where the teacher's own lessons and records live (files on the phone). */
export interface LessonStore {
  /** Every saved lesson file, read but not yet checked: the library decodes them like any input. */
  readonly listFiles: () => Promise<Result<readonly unknown[]>>;
  readonly save: (lesson: Lesson) => Promise<Result<void>>;
  readonly remove: (lessonId: string) => Promise<Result<void>>;
  readonly loadRecords: () => Promise<Records>;
  readonly saveRecords: (records: Records) => Promise<void>;
}
