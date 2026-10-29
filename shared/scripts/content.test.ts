import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { decodeLesson } from '@mimikai/contracts';
import { describe, expect, it } from 'vitest';
import { STARTER_REQUESTS, buildStarterLesson, lessonFileText } from './starterLessons';

const LESSONS_DIR = path.resolve(__dirname, '../../teacher/assets/lessons');

describe('starter lessons bundled in the teacher app', () => {
  it('has one file per teacher request, and nothing else', () => {
    expect(readdirSync(LESSONS_DIR).sort()).toEqual(STARTER_REQUESTS.map((s) => `${s.id}.json`).sort());
  });

  it.each(STARTER_REQUESTS.map((s) => [s.id, s] as const))('%s is valid and in sync with the engine (run build:content if not)', (id, starter) => {
    const text = readFileSync(path.join(LESSONS_DIR, `${id}.json`), 'utf8');
    expect(decodeLesson(JSON.parse(text)).ok).toBe(true);
    expect(text).toBe(lessonFileText(buildStarterLesson(starter)));
  });

  it('gives each request the number of exercises the teacher asked for', () => {
    for (const starter of STARTER_REQUESTS) expect(buildStarterLesson(starter).cards).toHaveLength(starter.count);
  });
});
