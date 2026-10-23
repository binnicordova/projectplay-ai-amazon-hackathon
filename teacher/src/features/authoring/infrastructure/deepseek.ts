/**
 * DeepSeek chat model (OpenAI-compatible API) as a ChatModel. JSON mode guarantees valid JSON,
 * not our shape: the application layer checks the shape and asks again when it is wrong.
 */
import { err, ok, type Result } from '@projectplay/contracts';
import type { ChatError, ChatModel } from '../application/ports';
import type { ChatMessage } from '../domain/prompt';

export interface DeepSeekConfig {
  readonly apiKey: string;
  /** e.g. "deepseek-flash". Falls back to "deepseek-chat" if the API does not know it. */
  readonly model: string;
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  readonly timeoutMs: number;
}

export const DEEPSEEK_DEFAULTS = { model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com', timeoutMs: 90_000 } as const;
const FALLBACK_MODEL = 'deepseek-chat';

interface Completion {
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[];
  readonly error?: { readonly message?: string };
}

function errorFor(status: number, detail: string): ChatError {
  if (status === 401 || status === 403) return { kind: 'rejected', message: 'La clave de DeepSeek no es válida. Revisa EXPO_PUBLIC_DEEPSEEK_API_KEY.' };
  if (status === 402) return { kind: 'rejected', message: 'La cuenta de DeepSeek no tiene saldo.' };
  if (status === 429 || status >= 500) return { kind: 'busy', message: 'La IA está ocupada. Intenta de nuevo en un momento.' };
  return { kind: 'rejected', message: `DeepSeek respondió ${status}: ${detail.slice(0, 160)}` };
}

const unknownModel = (status: number, detail: string) => (status === 400 || status === 404) && /model/i.test(detail);

export function deepSeekChatModel(config: DeepSeekConfig): ChatModel {
  const call = async (model: string, messages: readonly ChatMessage[]): Promise<Result<string, ChatError> & { readonly unknownModel?: boolean }> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), config.timeoutMs);
    try {
      const response = await config.fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model, messages, response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 8000, stream: false }),
        signal: abort.signal,
      });
      const text = await response.text();
      if (!response.ok) return { ...err(errorFor(response.status, text)), ...(unknownModel(response.status, text) ? { unknownModel: true } : {}) };
      let body: Completion;
      try {
        body = JSON.parse(text) as Completion;
      } catch {
        return err({ kind: 'bad-answer', message: 'DeepSeek respondió algo que no es JSON.' });
      }
      const content = body.choices?.[0]?.message?.content ?? '';
      // DeepSeek's JSON mode can occasionally return empty content: treat it as a bad answer (it is retried).
      return content.trim() ? ok(content) : err({ kind: 'bad-answer', message: 'La IA respondió vacío.' });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return err(aborted ? { kind: 'busy', message: 'La IA tardó demasiado. Intenta de nuevo.' } : { kind: 'offline', message: 'Sin conexión a internet. Conéctate para crear con IA.' });
    } finally {
      clearTimeout(timer);
    }
  };

  return async (messages) => {
    const first = await call(config.model, messages);
    if (first.ok || !first.unknownModel || config.model === FALLBACK_MODEL) return first.ok ? ok(first.value) : err(first.error);
    const second = await call(FALLBACK_MODEL, messages);
    return second.ok ? ok(second.value) : err(second.error);
  };
}
