import { SAMPLE_LESSON } from '@mimikai/contracts/src/testing/sampleLesson';
import { ok, type Lesson } from '@mimikai/contracts';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import type { Records } from '../domain/catalog';
import { lessonsAtom, makeLibrary, recordsAtom, selectedLessonAtom, unreadableLessonsAtom } from './library';
import type { LessonStore } from './ports';

function memoryStore(initial: readonly unknown[] = []) {
  let files: unknown[] = [...initial];
  let records: Records = {};
  const store: LessonStore = {
    listFiles: async () => ok(files),
    save: async (lesson) => {
      files = [...files.filter((f) => (f as Lesson).id !== lesson.id), lesson];
      return ok(undefined);
    },
    remove: async (id) => {
      files = files.filter((f) => (f as Lesson).id !== id);
      return ok(undefined);
    },
    loadRecords: async () => records,
    saveRecords: async (r) => {
      records = r;
    },
  };
  return { store, files: () => files, records: () => records };
}

const mine: Lesson = { ...SAMPLE_LESSON, id: 'ai-1', source: 'ai', createdAt: '2026-10-23T08:00:00.000Z' };

describe('library use cases', () => {
  it('loads the starter collection and the saved lessons, and reports damaged files', async () => {
    const jotai = createStore();
    const disk = memoryStore([mine, { format: 1, id: 'broken' }]);
    const library = makeLibrary({ store: jotai, files: disk.store, starterFiles: [SAMPLE_LESSON] });
    await library.load();
    expect(jotai.get(lessonsAtom).map((l) => l.id)).toEqual(['ai-1', SAMPLE_LESSON.id]);
    expect(jotai.get(unreadableLessonsAtom)).toHaveLength(1);
    expect(jotai.get(selectedLessonAtom)?.id).toBe('ai-1');
  });

  it('saves, replaces and deletes the teacher’s lessons', async () => {
    const jotai = createStore();
    const disk = memoryStore();
    const library = makeLibrary({ store: jotai, files: disk.store, starterFiles: [SAMPLE_LESSON] });
    await library.load();
    await library.save(mine);
    await library.save({ ...mine, title: 'Otra versión' });
    expect(jotai.get(lessonsAtom).filter((l) => l.id === 'ai-1')).toHaveLength(1);
    expect(disk.files()).toHaveLength(1);
    library.choose('ai-1');
    await library.remove('ai-1');
    expect(jotai.get(lessonsAtom).map((l) => l.id)).toEqual([SAMPLE_LESSON.id]);
    expect(jotai.get(selectedLessonAtom)?.id).toBe(SAMPLE_LESSON.id);
  });

  it('keeps the best score and writes it only when it improves', async () => {
    const jotai = createStore();
    const disk = memoryStore();
    const library = makeLibrary({ store: jotai, files: disk.store, starterFiles: [] });
    await library.recordScore('x', 2, 500);
    await library.recordScore('x', 2, 300);
    expect(jotai.get(recordsAtom)).toEqual({ 'x:2': 500 });
    expect(disk.records()).toEqual({ 'x:2': 500 });
  });
});
