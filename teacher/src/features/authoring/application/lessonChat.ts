/**
 * Creating a lesson by chatting with the AI. The teacher writes what they need; the AI answers
 * with a short message and a lesson draft; the draft is built and checked here. An answer that
 * breaks the format is sent back to the AI once with the reason, before giving up.
 */
import { err, flatMapResult, ok, type Lesson, type Result } from '@mimikai/contracts';
import { atom, type createStore } from 'jotai';
import { decodeAiReply, lessonFromDraft } from '../domain/draft';
import { modelMessages, type ChatMessage, type ChatTurn } from '../domain/prompt';
import type { ChatError, ChatModel } from './ports';

type Store = ReturnType<typeof createStore>;

export interface ChatOutcome {
  readonly reply: string;
  /** The assistant's JSON, kept so the AI can revise this lesson in the next turn. */
  readonly raw: string;
  readonly lesson: Lesson | null;
}

export interface LessonChatDeps {
  readonly model: ChatModel;
  /** ISO date-time. */
  readonly now: () => string;
  readonly newId: () => string;
  readonly random: () => number;
}

const toChatError = (message: string): ChatError => ({ kind: 'bad-answer', message });

/** One exchange: the teacher's text in, the assistant's reply (and maybe a lesson) out. */
export const makeAskForLesson =
  ({ model, now, newId, random }: LessonChatDeps) =>
  async (history: readonly ChatTurn[], text: string): Promise<Result<ChatOutcome, ChatError>> => {
    const turns: readonly ChatTurn[] = [...history, { role: 'teacher', text }];
    const firstRequest = turns.find((t) => t.role === 'teacher')?.text ?? text;
    const interpret = (raw: string): Result<ChatOutcome> =>
      flatMapResult(decodeAiReply(raw), (reply): Result<ChatOutcome> => {
        if (reply.lesson === null) return ok({ reply: reply.reply, raw, lesson: null });
        const lesson = lessonFromDraft(reply.lesson, { id: newId(), createdAt: now(), seed: Math.floor(random() * 2 ** 32) >>> 0, request: firstRequest });
        return lesson.ok ? ok({ reply: reply.reply, raw, lesson: lesson.value }) : lesson;
      });

    const ask = async (messages: readonly ChatMessage[]) => {
      const answer = await model(messages);
      return answer.ok ? { answer, outcome: interpret(answer.value) } : { answer, outcome: null };
    };

    const messages = modelMessages(turns);
    const first = await ask(messages);
    if (!first.answer.ok) return first.answer;
    if (first.outcome?.ok) return first.outcome;
    // One retry, telling the AI exactly what to fix.
    const problem = first.outcome?.ok === false ? first.outcome.error : 'unknown problem';
    const retry = await ask([
      ...messages,
      { role: 'assistant', content: first.answer.value },
      { role: 'user', content: `Tu respuesta no se pudo usar: ${problem}. Responde de nuevo solo con el objeto JSON pedido.` },
    ]);
    if (!retry.answer.ok) return retry.answer;
    return retry.outcome?.ok ? retry.outcome : err(toChatError(retry.outcome?.ok === false ? retry.outcome.error : problem));
  };

// ---------------------------------------------------------------------------
// Conversation state for the chat screen
// ---------------------------------------------------------------------------

export type ChatStatus = { readonly state: 'idle' } | { readonly state: 'thinking' } | { readonly state: 'error'; readonly error: ChatError };

export const chatTurnsAtom = atom<readonly ChatTurn[]>([]);
export const chatStatusAtom = atom<ChatStatus>({ state: 'idle' });
/** The latest lesson the AI drafted, waiting for the teacher to save it. */
export const draftLessonAtom = atom<Lesson | null>(null);

export interface LessonChat {
  readonly send: (text: string) => Promise<void>;
  /** Starts a new conversation. */
  readonly reset: () => void;
}

export function makeLessonChat(store: Store, ask: ReturnType<typeof makeAskForLesson>): LessonChat {
  return {
    send: async (text) => {
      const clean = text.trim();
      if (!clean || store.get(chatStatusAtom).state === 'thinking') return;
      const history = store.get(chatTurnsAtom);
      store.set(chatTurnsAtom, [...history, { role: 'teacher', text: clean }]);
      store.set(chatStatusAtom, { state: 'thinking' });
      const result = await ask(history, clean);
      if (!result.ok) {
        store.set(chatStatusAtom, { state: 'error', error: result.error });
        return;
      }
      store.set(chatTurnsAtom, (turns) => [...turns, { role: 'assistant', text: result.value.reply, raw: result.value.raw }]);
      if (result.value.lesson) store.set(draftLessonAtom, result.value.lesson);
      store.set(chatStatusAtom, { state: 'idle' });
    },
    reset: () => {
      store.set(chatTurnsAtom, []);
      store.set(draftLessonAtom, null);
      store.set(chatStatusAtom, { state: 'idle' });
    },
  };
}
