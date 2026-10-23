import { describe, expect, it } from 'vitest';
import { deepSeekChatModel } from './deepseek';
import { chatModelFor } from './providers';

type Call = { url: string; body: Record<string, unknown>; auth: string };

function fakeFetch(responses: ({ status: number; body: unknown } | 'network-down')[]) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) });
    const next = responses[calls.length - 1] ?? responses.at(-1)!;
    if (next === 'network-down') throw new TypeError('Network request failed');
    return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body), { status: next.status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const config = (fetchFn: typeof fetch) => ({ apiKey: 'sk-test', model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com', fetch: fetchFn, timeoutMs: 5000 });
const messages = [{ role: 'user' as const, content: 'hola' }];

describe('DeepSeek adapter', () => {
  it('asks for JSON mode with the key and returns the message content', async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { choices: [{ message: { content: '{"reply":"hola","lesson":null}' } }] } }]);
    const result = await deepSeekChatModel(config(fn))(messages);
    expect(result).toEqual({ ok: true, value: '{"reply":"hola","lesson":null}' });
    expect(calls[0]).toMatchObject({ url: 'https://api.deepseek.com/chat/completions', auth: 'Bearer sk-test', body: { model: 'deepseek-flash', response_format: { type: 'json_object' } } });
  });

  it('falls back to deepseek-chat when the model name is unknown', async () => {
    const { fn, calls } = fakeFetch([
      { status: 400, body: { error: { message: 'Model Not Exist' } } },
      { status: 200, body: { choices: [{ message: { content: '{}' } }] } },
    ]);
    expect((await deepSeekChatModel(config(fn))(messages)).ok).toBe(true);
    expect(calls.map((c) => c.body.model)).toEqual(['deepseek-flash', 'deepseek-chat']);
  });

  it.each([
    [401, 'rejected'],
    [402, 'rejected'],
    [429, 'busy'],
    [503, 'busy'],
  ] as const)('explains HTTP %i as %s', async (status, kind) => {
    const { fn } = fakeFetch([{ status, body: { error: { message: 'x' } } }]);
    expect(await deepSeekChatModel(config(fn))(messages)).toMatchObject({ ok: false, error: { kind } });
  });

  it('reports no internet, and an empty answer, without throwing', async () => {
    expect(await deepSeekChatModel(config(fakeFetch(['network-down']).fn))(messages)).toMatchObject({ ok: false, error: { kind: 'offline' } });
    const empty = fakeFetch([{ status: 200, body: { choices: [{ message: { content: '' } }] } }]);
    expect(await deepSeekChatModel(config(empty.fn))(messages)).toMatchObject({ ok: false, error: { kind: 'bad-answer' } });
  });

  it('tells the teacher when no key is configured', async () => {
    expect(await chatModelFor({ provider: 'deepseek' })(messages)).toMatchObject({ ok: false, error: { kind: 'not-configured' } });
    expect(await chatModelFor({ provider: 'gpt-x', deepseekApiKey: 'k' })(messages)).toMatchObject({ ok: false, error: { kind: 'not-configured' } });
  });
});
