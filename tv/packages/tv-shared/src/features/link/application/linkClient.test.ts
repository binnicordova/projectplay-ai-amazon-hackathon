import { decodeTvMessage, encodeMessage, type TeacherMessage } from '@projectplay/contracts';
import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkClient, linkStatusAtom, type Connection, type ConnectionHandlers, type Transport } from './linkClient';

/** A fake network where only `teacherHost` runs the phone app. */
class FakeTransport implements Transport {
  readonly opened: string[] = [];
  readonly toTeacher: string[] = [];
  teacher: ConnectionHandlers | null = null;
  constructor(private readonly teacherHost: string | null) {}

  connect(url: string, handlers: ConnectionHandlers): Connection {
    this.opened.push(url);
    const isTeacher = this.teacherHost !== null && url.includes(`//${this.teacherHost}:`);
    let closed = false;
    if (isTeacher) {
      this.teacher = handlers;
      setTimeout(() => {
        handlers.onOpen();
        handlers.onText(encodeMessage({ t: 'hello', role: 'teacher', app: '1.0.0' }));
      }, 50);
    }
    return {
      send: (text) => {
        if (isTeacher && !closed) this.toTeacher.push(text);
      },
      close: () => {
        if (closed) return;
        closed = true;
        setTimeout(() => handlers.onClose(), 0);
      },
    };
  }
}

const network = (ip: string | null) => ({ ownIpAddress: async () => ip });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LinkClient', () => {
  it('finds the phone at the hotspot gateway and says hello', async () => {
    const transport = new FakeTransport('192.168.71.1');
    const store = createStore();
    const client = new LinkClient(transport, network('192.168.71.23'), store, { platform: 'firetv' });
    client.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(store.get(linkStatusAtom)).toEqual({ state: 'connected', host: '192.168.71.1' });
    expect(transport.toTeacher.map((t) => decodeTvMessage(t))).toContainEqual({ ok: true, message: { t: 'hello', role: 'tv', platform: 'firetv' } });
  });

  it('sweeps the subnet when the phone is not the .1 gateway', async () => {
    const transport = new FakeTransport('192.168.71.150');
    const store = createStore();
    new LinkClient(transport, network('192.168.71.23'), store, { batchSize: 32, connectTimeoutMs: 200 }).start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.get(linkStatusAtom)).toEqual({ state: 'connected', host: '192.168.71.150' });
  });

  it('delivers teacher messages and answers pings', async () => {
    const transport = new FakeTransport('172.20.10.1');
    const store = createStore();
    const client = new LinkClient(transport, network(null), store);
    const received: TeacherMessage[] = [];
    client.onMessage((m) => received.push(m));
    client.start();
    await vi.advanceTimersByTimeAsync(100);
    transport.teacher!.onText(encodeMessage({ t: 'ptr', p: 1, x: 0.5, y: 0.5, c: 1 }));
    transport.teacher!.onText(encodeMessage({ t: 'ping', ts: 42 }));
    expect(received.map((m) => m.t)).toEqual(['ptr', 'ping']);
    expect(transport.toTeacher.some((t) => t.includes('"pong"'))).toBe(true);
  });

  it('goes back to searching when the phone falls silent', async () => {
    const transport = new FakeTransport('172.20.10.1');
    const store = createStore();
    new LinkClient(transport, network(null), store, { silenceTimeoutMs: 1000, retryDelayMs: 10_000 }).start();
    await vi.advanceTimersByTimeAsync(100);
    expect(store.get(linkStatusAtom).state).toBe('connected');
    await vi.advanceTimersByTimeAsync(1500);
    expect(store.get(linkStatusAtom).state).toBe('searching');
  });

  it('reports offline and keeps retrying when no phone is around', async () => {
    const transport = new FakeTransport(null);
    const store = createStore();
    new LinkClient(transport, network(null), store, { connectTimeoutMs: 100, retryDelayMs: 500 }).start();
    await vi.advanceTimersByTimeAsync(200);
    expect(store.get(linkStatusAtom).state).toBe('offline');
    const before = transport.opened.length;
    await vi.advanceTimersByTimeAsync(700);
    expect(transport.opened.length).toBeGreaterThan(before);
  });
});
