import { decodeTeacherMessage, encodeMessage, type TeacherMessage } from '@projectplay/contracts';
import { createStore } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLinkService, roundResultsAtom, serverStatusAtom, tvClientsAtom, tvSnapshotAtom } from './linkService';
import type { LinkServer, LinkServerEvents } from './ports';

class FakeServer implements LinkServer {
  events: LinkServerEvents | null = null;
  readonly sent: TeacherMessage[] = [];
  start(_port: number, events: LinkServerEvents) {
    this.events = events;
    events.onStatus({ state: 'listening', port: 8787 });
  }
  stop() {}
  broadcast(text: string) {
    const decoded = decodeTeacherMessage(text);
    if (decoded.ok) this.sent.push(decoded.message);
  }
}

function setup() {
  vi.useFakeTimers();
  const server = new FakeServer();
  const store = createStore();
  const link = createLinkService(server, store, { heartbeatMs: 1000, now: () => 5000 });
  link.start();
  return { server, store, link, events: server.events! };
}

afterEach(() => vi.useRealTimers());

describe('link service', () => {
  it('greets a TV as soon as it connects', () => {
    const { server, store, events } = setup();
    expect(store.get(serverStatusAtom)).toEqual({ state: 'listening', port: 8787 });
    events.onClientConnected(1, '192.168.43.20');
    expect(server.sent[0]).toEqual({ t: 'hello', role: 'teacher', app: '1.0.0' });
    events.onText(1, encodeMessage({ t: 'hello', role: 'tv', platform: 'android' }));
    expect(store.get(tvClientsAtom)).toEqual([{ id: 1, address: '192.168.43.20', platform: 'android' }]);
  });

  it('does not send anything while no TV is connected', () => {
    const { server, link } = setup();
    link.send({ t: 'ctl', a: 'next' });
    vi.advanceTimersByTime(3000);
    expect(server.sent).toEqual([]);
  });

  it('sends heartbeats while a TV is connected', () => {
    const { server, events } = setup();
    events.onClientConnected(1, 'tv');
    vi.advanceTimersByTime(2000);
    expect(server.sent.filter((m) => m.t === 'ping')).toHaveLength(2);
  });

  it('tracks the TV session state and per-round results', () => {
    const { store, link, events } = setup();
    const snapshots: unknown[] = [];
    link.onSnapshot((s) => snapshots.push(s));
    events.onClientConnected(1, 'tv');
    events.onText(1, encodeMessage({ t: 'state', phase: 'question', round: 1, rounds: 3, mode: 'choice', prompt: '2 + 2 = ?', scores: { A: 0, B: 0 } }));
    events.onText(1, encodeMessage({ t: 'result', round: 1, correct: true, team: 'A', ms: 3000 }));
    events.onText(1, encodeMessage({ t: 'result', round: 1, correct: false, team: 'B', ms: 4000 }));
    events.onText(1, encodeMessage({ t: 'result', round: 1, correct: true, team: 'A', ms: 3000 }));
    expect(store.get(tvSnapshotAtom)?.prompt).toBe('2 + 2 = ?');
    expect(store.get(roundResultsAtom)).toHaveLength(2);
    expect(snapshots).toHaveLength(1);

    events.onText(1, 'garbage');
    expect(store.get(roundResultsAtom)).toHaveLength(2);

    events.onClientDisconnected(1);
    expect(store.get(tvSnapshotAtom)).toBeNull();
  });
});
