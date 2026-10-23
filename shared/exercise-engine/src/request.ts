/**
 * What a teacher can ask the engine for. The AI (or the starter-lesson script) turns a teacher's
 * request into one of these; the engine then builds the cards, so every answer key is computed,
 * never guessed.
 */
import type { AgeBand, Card, Subject } from '@projectplay/contracts';
import type { GeneratorContext } from './cards';
import { compareCards, numberCards, type CompareParams, type NumbersParams } from './generators/counting';
import { englishCards, type EnglishParams } from './generators/english';
import { letterCards, type LettersParams } from './generators/letters';
import { arithmeticCards, equationCards, fractionCards, type ArithmeticParams, type EquationsParams, type FractionsParams } from './generators/math';
import {
  sentenceCards,
  soundPracticeCards,
  syllablePracticeCards,
  syllableSoundCards,
  type SoundPracticeParams,
  type SyllableSoundsParams,
  type SyllablesParams,
} from './generators/reading';
import { mixSeed, mulberry32 } from './random';

export type ExerciseRequest =
  | ({ readonly kind: 'numbers' } & NumbersParams)
  | ({ readonly kind: 'compare' } & CompareParams)
  | ({ readonly kind: 'letters' } & LettersParams)
  | ({ readonly kind: 'syllableSounds' } & SyllableSoundsParams)
  | ({ readonly kind: 'syllables' } & SyllablesParams)
  | ({ readonly kind: 'soundPractice' } & SoundPracticeParams)
  | { readonly kind: 'completeSentence' }
  | ({ readonly kind: 'english' } & EnglishParams)
  | ({ readonly kind: 'fractions' } & FractionsParams)
  | ({ readonly kind: 'equations' } & EquationsParams)
  | ({ readonly kind: 'arithmetic' } & ArithmeticParams);

export type ExerciseKind = ExerciseRequest['kind'];

export const EXERCISE_KINDS: readonly ExerciseKind[] = [
  'numbers', 'compare', 'letters', 'syllableSounds', 'syllables', 'soundPractice', 'completeSentence', 'english', 'fractions', 'equations', 'arithmetic',
];

/** One line per generator, in the words the AI needs to choose one. Kept next to the code it describes. */
export const EXERCISE_GUIDE: Readonly<Record<ExerciseKind, string>> = {
  numbers: '{"kind":"numbers","from":1,"to":9} contar un grupo de dibujos y elegir el número; luego buscar el grupo que tiene N',
  compare: '{"kind":"compare","max":10} contar grupos y decidir dónde hay más o menos',
  letters:
    '{"kind":"letters","from":"a","to":"m","theme":"animal"} reconocer letras; sin theme: buscar la letra (vocales primero); con theme: la primera letra de cada dibujo',
  syllableSounds: '{"kind":"syllableSounds","theme":"granja"} la profe dice una sílaba y los niños señalan el dibujo que empieza así (theme: granja, animal, fruta, cosa)',
  syllables: '{"kind":"syllables","syllables":["MA","PA","RO"]} practicar sílabas: primera sílaba, sílaba que falta, dibujo que empieza con la sílaba',
  soundPractice: '{"kind":"soundPractice","sound":"RO"} reforzar un sonido difícil (RO también practica RR de perro): repetir la palabra y señalar',
  completeSentence: '{"kind":"completeSentence"} completar una frase corta con la palabra que falta',
  english: '{"kind":"english","theme":"animal"} vocabulario en inglés: dibujo → palabra en inglés y al revés (theme opcional)',
  fractions: '{"kind":"fractions","big":true} fracciones: simplificar, equivalentes, la mayor, sumar y fracción de una cantidad',
  equations: '{"kind":"equations","traps":true} ecuaciones lineales con trampas típicas de signos y paréntesis',
  arithmetic: '{"kind":"arithmetic","operation":"multiplicacion","table":9} suma, resta, faltante o multiplicacion (table = tabla a practicar, max = resultado máximo)',
};

/** The school subject a kind of exercise belongs to, when the teacher did not name one. */
export const SUBJECT_OF: Readonly<Record<ExerciseKind, Subject>> = {
  numbers: 'matematica',
  compare: 'matematica',
  fractions: 'matematica',
  equations: 'matematica',
  arithmetic: 'matematica',
  letters: 'comunicacion',
  syllableSounds: 'comunicacion',
  syllables: 'comunicacion',
  soundPractice: 'comunicacion',
  completeSentence: 'comunicacion',
  english: 'ingles',
};

export interface GenerateOptions {
  readonly band: AgeBand;
  readonly count: number;
  readonly seed: number;
  /** Prefix for card ids (default: the request kind). */
  readonly idPrefix?: string;
}

export const MAX_CARDS = 40;

/**
 * Cards for a request, easy to hard. Fewer than `count` when the material runs out (e.g. a
 * syllable no picture starts with); an empty list means the request cannot be served.
 */
export function generateCards(request: ExerciseRequest, { band, count, seed, idPrefix }: GenerateOptions): readonly Card[] {
  const ctx: GeneratorContext = {
    band,
    count: Math.max(1, Math.min(MAX_CARDS, Math.floor(count))),
    random: mulberry32(mixSeed(seed, JSON.stringify(request), band)),
    idPrefix: idPrefix ?? `${request.kind}-`,
  };
  switch (request.kind) {
    case 'numbers':
      return numberCards(request, ctx);
    case 'compare':
      return compareCards(request, ctx);
    case 'letters':
      return letterCards(request, ctx);
    case 'syllableSounds':
      return syllableSoundCards(request, ctx);
    case 'syllables':
      return syllablePracticeCards(request, ctx);
    case 'soundPractice':
      return soundPracticeCards(request, ctx);
    case 'completeSentence':
      return sentenceCards(ctx);
    case 'english':
      return englishCards(request, ctx);
    case 'fractions':
      return fractionCards(request, ctx);
    case 'equations':
      return equationCards(request, ctx);
    case 'arithmetic':
      return arithmeticCards(request, ctx);
  }
}
