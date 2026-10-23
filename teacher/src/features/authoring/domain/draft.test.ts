import { describe, expect, it } from 'vitest';
import { decodeAiReply, decodeExerciseRequest, lessonFromDraft, type DraftSpec } from './draft';
import { modelMessages, systemPrompt } from './prompt';

const context = { id: 'ai-test', createdAt: '2026-10-23T09:00:00.000Z', seed: 11, request: 'pedido de prueba' };

describe('reading the AI answer', () => {
  it('reads a generator lesson and clamps its parameters', () => {
    const reply = decodeAiReply(
      JSON.stringify({ reply: 'Listo.', lesson: { title: 'Tabla del 9', subject: 'matematica', band: 'primaria', age: 8, count: 99, generator: { kind: 'arithmetic', operation: 'multiplicacion', table: 9 } } }),
    );
    expect(reply.ok && reply.value.lesson).toMatchObject({ count: 40, exercises: { kind: 'generator', request: { kind: 'arithmetic', operation: 'multiplicacion', table: 9 } } });
  });

  it('accepts a plain answer with no lesson', () => {
    expect(decodeAiReply('{"reply":"¡Hola! ¿Qué tema quieres trabajar?","lesson":null}')).toEqual({ ok: true, value: { reply: '¡Hola! ¿Qué tema quieres trabajar?', lesson: null } });
  });

  it.each([
    ['text that is not JSON', 'Claro, aquí tienes los ejercicios'],
    ['an unknown subject', JSON.stringify({ reply: 'x', lesson: { title: 't', subject: 'alquimia', band: 'primaria', generator: { kind: 'numbers' } } })],
    ['an unknown generator', JSON.stringify({ reply: 'x', lesson: { title: 't', subject: 'matematica', band: 'primaria', generator: { kind: 'magic' } } })],
    ['syllables without syllables', JSON.stringify({ reply: 'x', lesson: { title: 't', subject: 'comunicacion', band: 'primaria', generator: { kind: 'syllables', syllables: [] } } })],
    ['a card whose answer points nowhere', JSON.stringify({ reply: 'x', lesson: { title: 't', subject: 'ciencia', band: 'primaria', cards: [{ question: 'q', options: ['a', 'b'], answer: 5 }] } })],
    ['no generator and no cards', JSON.stringify({ reply: 'x', lesson: { title: 't', subject: 'ciencia', band: 'primaria' } })],
  ])('explains what is wrong with %s', (_label, text) => {
    const result = decodeAiReply(text);
    expect(result.ok).toBe(false);
  });

  it('ignores unknown or out-of-range generator parameters instead of failing', () => {
    expect(decodeExerciseRequest({ kind: 'numbers', from: 9, to: 1, color: 'rojo' })).toEqual({ ok: true, value: { kind: 'numbers', from: 1, to: 9 } });
    expect(decodeExerciseRequest({ kind: 'letters', from: 'a', to: 'mm', theme: 'dragones' })).toEqual({ ok: true, value: { kind: 'letters', from: 'a' } });
  });
});

describe('building the lesson', () => {
  it('lets the engine build generator lessons, with the teacher’s request recorded', () => {
    const draft: DraftSpec = { title: 'Sílabas', subject: 'comunicacion', band: 'primaria', count: 6, exercises: { kind: 'generator', request: { kind: 'syllables', syllables: ['MA', 'PA'] } } };
    const lesson = lessonFromDraft(draft, context);
    expect(lesson.ok).toBe(true);
    if (!lesson.ok) return;
    expect(lesson.value).toMatchObject({ id: 'ai-test', source: 'ai', request: 'pedido de prueba' });
    expect(lesson.value.cards).toHaveLength(6);
  });

  it('turns AI-written cards into pictures when it can, and keeps pre-readers to three tiles', () => {
    const draft: DraftSpec = {
      title: 'Animales',
      subject: 'ciencia',
      band: 'inicial',
      count: 2,
      exercises: {
        kind: 'cards',
        cards: [
          { kind: 'choice', question: '¿Cuál vive en el agua?', options: ['vaca', 'pez', 'gato', 'perro'], answer: 1, say: '¿Cuál vive en el agua?' },
          { kind: 'trueFalse', statement: 'El pulpo tiene ocho brazos', picture: 'pulpo', answer: true },
        ],
      },
    };
    const lesson = lessonFromDraft(draft, context);
    expect(lesson.ok).toBe(true);
    if (!lesson.ok) return;
    const [choice, truth] = lesson.value.cards;
    expect(choice?.kind === 'choice' && choice.options).toHaveLength(3);
    expect(choice?.kind === 'choice' && choice.options.every((o) => o.kind === 'icon')).toBe(true);
    expect(choice?.kind === 'choice' && choice.options[choice.answer]).toMatchObject({ kind: 'icon', label: 'pez' });
    expect(truth).toMatchObject({ kind: 'trueFalse', answer: true, prompt: { visual: { kind: 'icon', label: 'pulpo' } } });
    expect(lesson.value.cards.map((c) => c.level)).toEqual([1, 2]);
  });

  it('refuses a lesson whose cards would show two identical tiles', () => {
    const draft: DraftSpec = { title: 'x', subject: 'arte', band: 'primaria', count: 1, exercises: { kind: 'cards', cards: [{ kind: 'choice', question: 'q', options: ['rojo', 'Rojo'], answer: 0 }] } };
    expect(lessonFromDraft(draft, context).ok).toBe(false);
  });
});

describe('what the AI is told', () => {
  it('lists every generator and the picture words, and asks for JSON', () => {
    const prompt = systemPrompt();
    expect(prompt).toContain('"kind":"soundPractice"');
    expect(prompt).toContain('rana');
    expect(prompt).toContain('JSON');
  });

  it('sends the instructions first, then the latest turns, with the assistant’s JSON for context', () => {
    const turns = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? { role: 'teacher' as const, text: `pedido ${i}` } : { role: 'assistant' as const, text: 'ok', raw: `{"n":${i}}` }));
    const messages = modelMessages(turns);
    expect(messages[0]?.role).toBe('system');
    expect(messages).toHaveLength(13);
    expect(messages.at(-1)).toEqual({ role: 'assistant', content: '{"n":19}' });
  });
});
