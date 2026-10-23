/**
 * @projectplay/exercise-engine
 *
 * Builds lesson cards for early-grade to secondary classes, offline and deterministically:
 * the same request and seed always give the same cards, and every answer is computed
 * (syllables by rule, arithmetic by construction), never guessed.
 */
export * from './arithmetic';
export { buildCards, choice, keyOf, levelsFor, optionCount, type ChoiceSpec, type GeneratorContext } from './cards';
export { LEXICON, TAGS, article, findWord, foldWord, plural, wordsTagged, type Tag, type Word } from './lexicon';
export { clapped, firstSyllable, soundOf, soundPositions, syllabify } from './syllables';
export { SENTENCES } from './generators/reading';
export { ALPHABET, initialOf } from './generators/letters';
export * from './request';
export { randomInt, shuffle, type Random } from './random';
