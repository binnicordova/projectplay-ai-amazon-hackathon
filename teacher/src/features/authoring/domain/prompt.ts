/**
 * The instructions the AI gets with every conversation. Built from the engine's own catalogue,
 * so the AI only ever asks for exercises the engine can build and pictures the app has.
 */
import { SUBJECTS } from '@mimikai/contracts';
import { EXERCISE_GUIDE, EXERCISE_KINDS, LEXICON, TAGS } from '@mimikai/exercise-engine';

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

const EXAMPLE = {
  reply: 'Listo: 8 ejercicios para contar del 1 al 9, de fácil a difícil.',
  lesson: { title: 'Números del 1 al 9', subject: 'matematica', band: 'primaria', age: 6, count: 8, generator: { kind: 'numbers', from: 1, to: 9 } },
};

const CARDS_EXAMPLE = {
  reply: 'Preparé 3 preguntas sobre animales del mar.',
  lesson: {
    title: 'Animales del mar',
    subject: 'ciencia',
    band: 'primaria',
    age: 7,
    cards: [
      { level: 1, question: '¿Cuál vive en el mar?', options: ['ballena', 'vaca', 'gallina'], pictures: true, answer: 0, explain: 'La ballena vive en el mar.' },
      { level: 2, statement: 'El pulpo tiene ocho brazos', picture: 'pulpo', answer: true },
      { level: 3, question: '¿Qué respira el pez?', options: ['oxígeno del agua', 'humo', 'arena'], answer: 0, explain: 'Usa sus branquias.' },
    ],
  },
};

export function systemPrompt(): string {
  const words = LEXICON.map((w) => w.es).join(', ');
  return [
    'Eres el asistente de Mimikai. Ayudas a docentes de América Latina a crear ejercicios que los niños responden señalando la pared proyectada.',
    'Respondes SIEMPRE con un único objeto JSON, sin texto fuera del JSON:',
    '{"reply": "1 o 2 frases para la docente, en español", "lesson": null o la lección}',
    '',
    'La lección tiene: title, subject (' + SUBJECTS.join(', ') + '), band (inicial 4-6 años, primaria 6-12, secundaria 12-16), age (opcional), count (cuántos ejercicios pidió; 10 si no dijo) y UNA de estas dos formas:',
    '1. "generator": cuando el pedido encaja con un generador. Los generadores calculan las respuestas, así que son la mejor opción. Generadores:',
    ...EXERCISE_KINDS.map((kind) => `   - ${EXERCISE_GUIDE[kind]}`),
    `   theme puede ser: ${TAGS.join(', ')}.`,
    '2. "cards": para otros temas (ciencia, historia, personal social, arte, valores...). Cada tarjeta es',
    '   {"level":1-3,"question":"...","options":["...","..."],"answer":índice,"pictures":true|false,"picture":"palabra","say":"...","explain":"..."}',
    '   o de verdadero/falso {"level":1-3,"statement":"...","answer":true|false,"picture":"palabra","explain":"..."}.',
    '   Datos correctos y adecuados a la edad. Una sola respuesta correcta; las incorrectas deben ser creíbles. Ordena de fácil (level 1) a difícil (level 3).',
    '   Opciones: inicial máximo 3, primaria 3 o 4, secundaria 4. Textos cortos (máximo 48 letras por opción).',
    '   En inicial los niños no leen: usa "pictures": true con opciones que sean palabras de la lista de dibujos, y escribe en "say" lo que la docente lee en voz alta.',
    `   "picture" y las opciones con "pictures": true solo pueden usar estas palabras: ${words}.`,
    '',
    'Si la docente pide cambios ("más fácil", "agrega 3", "para 5 años"), devuelve la lección completa actualizada.',
    'Si solo saluda o pregunta algo, responde con "lesson": null.',
    'Ejemplo con generador: ' + JSON.stringify(EXAMPLE),
    'Ejemplo con tarjetas: ' + JSON.stringify(CARDS_EXAMPLE),
  ].join('\n');
}

/** One message in the visible conversation. The assistant's raw JSON is kept so the AI can revise its last lesson. */
export interface ChatTurn {
  readonly role: 'teacher' | 'assistant';
  /** What the teacher typed, or the assistant's reply sentence. */
  readonly text: string;
  /** The assistant's full JSON answer. */
  readonly raw?: string;
}

/** The messages sent to the model: instructions, then the conversation so far (the last turns only). */
export function modelMessages(turns: readonly ChatTurn[], keep = 12): readonly ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt() },
    ...turns.slice(-keep).map((turn): ChatMessage => (turn.role === 'teacher' ? { role: 'user', content: turn.text } : { role: 'assistant', content: turn.raw ?? turn.text })),
  ];
}

/** Ready-made requests, shown as chips: the same ones the starter collection was built from, and more. */
export const EXAMPLE_REQUESTS: readonly string[] = [
  'créame 10 ejercicios de la tabla del 9 para niños de 8 años',
  'genera 8 ejercicios para reconocer los números del 1 al 9 para niños de 6 años',
  'créame 5 ejercicios sobre las sílabas MA, PA, RO',
  'quiero 8 preguntas sobre los animales de la costa, sierra y selva del Perú para niños de 9 años',
  'genera 6 preguntas de verdadero o falso sobre el sistema solar para 10 años',
  'quiero 10 ejercicios de inglés con frutas para niños de 7 años',
];
