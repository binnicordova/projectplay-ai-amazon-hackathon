/**
 * The starter collection: real requests from a teacher, each turned into an exercise request
 * the way the AI chat does it, then built by the engine. Bundled in the teacher app as files.
 */
import { decodeLesson, type AgeBand, type Audience, type Lesson, type Subject } from '@mimikai/contracts';
import { generateCards, type ExerciseRequest } from '@mimikai/exercise-engine';

export interface StarterRequest {
  readonly id: string;
  /** The teacher's words, as typed. */
  readonly request: string;
  readonly title: string;
  readonly subject: Subject;
  readonly audience: Audience;
  readonly exercise: ExerciseRequest;
  readonly count: number;
}

const audience = (band: AgeBand, age?: number): Audience => (age === undefined ? { band } : { band, age });

export const STARTER_REQUESTS: readonly StarterRequest[] = [
  {
    id: 'numeros-1-al-9',
    request: 'genera 8 ejercicios para reconocer los numeros del 1 al 9 para niños de 6 años',
    title: 'Números del 1 al 9',
    subject: 'matematica',
    audience: audience('primaria', 6),
    exercise: { kind: 'numbers', from: 1, to: 9 },
    count: 8,
  },
  {
    id: 'letras-inicial',
    request: 'creame 12 ejercicios para reconocer las letras para niños de 5años inicial',
    title: 'Reconozco las letras',
    subject: 'comunicacion',
    audience: audience('inicial', 5),
    exercise: { kind: 'letters' },
    count: 12,
  },
  {
    id: 'letras-a-m-animales',
    request: "genera 13 ejercicios para reconocer las letras del 'a' a la 'm' usando animales",
    title: 'Letras de la a a la m con animales',
    subject: 'comunicacion',
    audience: audience('primaria'),
    exercise: { kind: 'letters', from: 'a', to: 'm', theme: 'animal' },
    count: 13,
  },
  {
    id: 'silabas-granja',
    request: 'creame 15 ejercicios para reconocer como suenan las silabas con animales de la granja',
    title: 'Cómo suenan las sílabas: la granja',
    subject: 'comunicacion',
    audience: audience('inicial'),
    exercise: { kind: 'syllableSounds', theme: 'granja' },
    count: 15,
  },
  {
    id: 'silabas-ma-pa-ro',
    request: 'creame 5 ejercicios sobre las silabas MA, PA, RO',
    title: 'Sílabas MA, PA, RO',
    subject: 'comunicacion',
    audience: audience('primaria'),
    exercise: { kind: 'syllables', syllables: ['MA', 'PA', 'RO'] },
    count: 5,
  },
  {
    id: 'refuerzo-ro-perro',
    request: 'quiero 6 ejercicios para reforzar la silaba RO, para mis niñas de 5 años que les cuestra pronunciar palabras como PERRO',
    title: 'Refuerzo la RO: pe-RRO',
    subject: 'comunicacion',
    audience: audience('inicial', 5),
    exercise: { kind: 'soundPractice', sound: 'RO' },
    count: 6,
  },
  {
    id: 'fracciones-numeros-grandes',
    request: 'generame 12 ejercicios de fracciones para, los adolescentes de 13 años con numeros grandes',
    title: 'Fracciones con números grandes',
    subject: 'matematica',
    audience: audience('secundaria', 13),
    exercise: { kind: 'fractions', big: true },
    count: 12,
  },
  {
    id: 'ecuaciones-con-trampa',
    request: 'generame 5 ejercisios de ecuaciones para adolescentes de 15 años con trampas que les hagan pensar en la posible respuesta',
    title: 'Ecuaciones con trampa',
    subject: 'matematica',
    audience: audience('secundaria', 15),
    exercise: { kind: 'equations', traps: true },
    count: 5,
  },
  {
    id: 'ingles-imagenes',
    request: 'quiero 20 ejercicios de ingles de como se traduce la imagen al ingles para niños de 6 años',
    title: 'Inglés: ¿cómo se dice?',
    subject: 'ingles',
    audience: audience('primaria', 6),
    exercise: { kind: 'english' },
    count: 20,
  },
  {
    id: 'completa-la-frase',
    request: 'genera 15 ejercicios de completa la phrase para niños de 7 años',
    title: 'Completa la frase',
    subject: 'comunicacion',
    audience: audience('primaria', 7),
    exercise: { kind: 'completeSentence' },
    count: 15,
  },
  {
    id: 'mas-o-menos',
    request: 'quiero ejercicios para decidir cual es mayor o menor, para que los niños cuenten y decidan.',
    title: '¿Dónde hay más? ¿Dónde hay menos?',
    subject: 'matematica',
    audience: audience('inicial'),
    exercise: { kind: 'compare', max: 10 },
    count: 10,
  },
];

/** Fixed date and seed: rebuilding the collection gives byte-identical files. */
export const STARTER_DATE = '2026-10-22T00:00:00.000Z';
const STARTER_SEED = 2026;

export function buildStarterLesson(starter: StarterRequest): Lesson {
  const cards = generateCards(starter.exercise, { band: starter.audience.band, count: starter.count, seed: STARTER_SEED, idPrefix: `${starter.id}-` });
  const lesson: Lesson = {
    format: 1,
    id: starter.id,
    title: starter.title,
    subject: starter.subject,
    audience: starter.audience,
    source: 'starter',
    request: starter.request,
    createdAt: STARTER_DATE,
    cards,
  };
  const checked = decodeLesson(JSON.parse(JSON.stringify(lesson)));
  if (!checked.ok) throw new Error(`Starter lesson ${starter.id} is invalid: ${checked.error}`);
  return checked.value;
}

export const lessonFileText = (lesson: Lesson): string => `${JSON.stringify(lesson, null, 2)}\n`;
