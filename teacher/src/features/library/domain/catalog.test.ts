import { SAMPLE_LESSON } from '@mimikai/contracts/src/testing/sampleLesson';
import { describe, expect, it } from 'vitest';
import { countBySubject, coverIcon, levelCounts, lessonsIn, mergeLibrary, recordOf, roundsFor, withScore } from './catalog';

const own = { ...SAMPLE_LESSON, id: 'mine', source: 'ai' as const, subject: 'ciencia' as const, createdAt: '2026-10-23T10:00:00.000Z' };
const older = { ...own, id: 'mine-old', createdAt: '2026-10-21T10:00:00.000Z' };

describe('library', () => {
  it('lists the teacher’s lessons first, newest first, then the starter collection', () => {
    expect(mergeLibrary([SAMPLE_LESSON], [older, own]).map((l) => l.id)).toEqual(['mine', 'mine-old', SAMPLE_LESSON.id]);
  });

  it('never lets a saved copy hide a starter lesson', () => {
    expect(mergeLibrary([SAMPLE_LESSON], [{ ...SAMPLE_LESSON, title: 'copia' }])).toEqual([SAMPLE_LESSON]);
  });

  it('filters by subject and age group, and counts per subject', () => {
    const all = mergeLibrary([SAMPLE_LESSON], [own]);
    expect(lessonsIn(all, 'ciencia', null)).toEqual([own]);
    expect(lessonsIn(all, null, 'secundaria')).toEqual([]);
    expect(countBySubject(all)).toMatchObject({ ciencia: 1, comunicacion: 1, matematica: 0 });
  });

  it('keeps only the best score per lesson and team count', () => {
    const r1 = withScore({}, 'a', 2, 300);
    expect(withScore(r1, 'a', 2, 200)).toBe(r1);
    expect(recordOf(withScore(r1, 'a', 2, 450), 'a', 2)).toBe(450);
    expect(recordOf(r1, 'a', 1)).toBeUndefined();
  });

  it('describes a lesson for its card', () => {
    expect(levelCounts(SAMPLE_LESSON)).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(coverIcon(SAMPLE_LESSON)).toBe('1f986');
    expect(roundsFor(SAMPLE_LESSON, 10)).toBe(3);
  });
});
