/** A tiny valid lesson for tests on both sides of the wire. */
import type { Lesson } from '../lesson';

export const SAMPLE_LESSON: Lesson = {
  format: 1,
  id: 'sample-silabas',
  title: 'Sílabas MA, PA, RO',
  subject: 'comunicacion',
  audience: { band: 'primaria', age: 6 },
  source: 'starter',
  request: 'creame 5 ejercicios sobre las silabas MA, PA, RO',
  createdAt: '2026-10-22T00:00:00.000Z',
  cards: [
    {
      kind: 'choice',
      id: 'c1',
      level: 1,
      prompt: { text: '¿Con qué sílaba empieza?', visual: { kind: 'icon', icon: '1f986', label: 'pato' }, say: '¿Con qué sílaba empieza pato?' },
      options: [
        { kind: 'text', text: 'PA' },
        { kind: 'text', text: 'MA' },
        { kind: 'text', text: 'RO' },
      ],
      answer: 0,
    },
    {
      kind: 'choice',
      id: 'c2',
      level: 2,
      prompt: { text: '¿Dónde hay más?' },
      options: [
        { kind: 'group', icon: '1f34e', count: 3 },
        { kind: 'group', icon: '1f34e', count: 7 },
      ],
      answer: 1,
    },
    { kind: 'trueFalse', id: 'c3', level: 3, prompt: { text: 'ROSA empieza con RO' }, answer: true, explain: 'RO-SA' },
  ],
};

export const SAMPLE_ART = {
  '1f986': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FFCC4D"/></svg>',
  '1f34e': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#DD2E44"/></svg>',
} as const;
