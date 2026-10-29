import { err, ok } from '@mimikai/contracts';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../domain/prompt';
import { chatStatusAtom, chatTurnsAtom, draftLessonAtom, makeAskForLesson, makeLessonChat } from './lessonChat';
import type { ChatModel } from './ports';

const GOOD = JSON.stringify({
  reply: 'Listo: 6 ejercicios de la tabla del 9.',
  lesson: { title: 'Tabla del 9', subject: 'matematica', band: 'primaria', age: 8, count: 6, generator: { kind: 'arithmetic', operation: 'multiplicacion', table: 9 } },
});

/** A scripted model: answers in order, and remembers what it was sent. */
function scripted(...answers: (string | { error: 'offline' })[]) {
  const calls: (readonly ChatMessage[])[] = [];
  const model: ChatModel = async (messages) => {
    calls.push(messages);
    const next = answers[calls.length - 1] ?? answers.at(-1)!;
    return typeof next === 'string' ? ok(next) : err({ kind: 'offline', message: 'Sin internet' });
  };
  return { model, calls };
}

const deps = (model: ChatModel) => ({ model, now: () => '2026-10-23T09:00:00.000Z', newId: () => 'ai-1', random: () => 0.25 });

describe('creating a lesson by chat', () => {
  it('turns the teacher’s request into a checked lesson', async () => {
    const { model, calls } = scripted(GOOD);
    const result = await makeAskForLesson(deps(model))([], 'créame 6 ejercicios de la tabla del 9 para 8 años');
    expect(result.ok && result.value.lesson?.cards).toHaveLength(6);
    expect(result.ok && result.value.lesson?.request).toBe('créame 6 ejercicios de la tabla del 9 para 8 años');
    expect(calls[0]?.at(-1)).toEqual({ role: 'user', content: 'créame 6 ejercicios de la tabla del 9 para 8 años' });
  });

  it('asks the AI once more, with the reason, when an answer breaks the format', async () => {
    const { model, calls } = scripted('Claro, aquí van tus ejercicios: ...', GOOD);
    const result = await makeAskForLesson(deps(model))([], 'tabla del 9');
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.at(-1)?.content).toContain('not valid JSON');
  });

  it('gives up after the retry with an error the screen can show', async () => {
    const { model } = scripted('no json', 'still no json');
    const result = await makeAskForLesson(deps(model))([], 'tabla del 9');
    expect(result).toMatchObject({ ok: false, error: { kind: 'bad-answer' } });
  });

  it('keeps the conversation, the draft and the status in the store', async () => {
    const store = createStore();
    const { model } = scripted(GOOD, { error: 'offline' });
    const chat = makeLessonChat(store, makeAskForLesson(deps(model)));
    await chat.send('tabla del 9');
    expect(store.get(chatTurnsAtom).map((t) => t.role)).toEqual(['teacher', 'assistant']);
    expect(store.get(draftLessonAtom)?.title).toBe('Tabla del 9');
    await chat.send('hazlo para 7 años');
    expect(store.get(chatStatusAtom)).toMatchObject({ state: 'error', error: { kind: 'offline' } });
    expect(store.get(draftLessonAtom)?.title).toBe('Tabla del 9');
    chat.reset();
    expect(store.get(chatTurnsAtom)).toEqual([]);
  });
});
