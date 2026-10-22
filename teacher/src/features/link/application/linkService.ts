/**
 * Link use cases on the phone: run the server, greet TVs, keep the connection
 * alive, and turn TV messages into state the teacher console can show.
 */
import {
  DEFAULT_PORT,
  decodeTvMessage,
  encodeMessage,
  type SessionSnapshot,
  type TeacherMessage,
  type TvMessage,
} from '@projectplay/contracts';
import { atom, type createStore } from 'jotai';
import type { ClientId, LinkServer, ServerStatus } from './ports';

type Store = ReturnType<typeof createStore>;

export interface TvClient {
  readonly id: ClientId;
  readonly address: string;
  readonly platform: string | null;
}

export type RoundResult = Extract<TvMessage, { t: 'result' }>;

export const serverStatusAtom = atom<ServerStatus>({ state: 'stopped' });
export const tvClientsAtom = atom<readonly TvClient[]>([]);
export const tvConnectedAtom = atom((get) => get(tvClientsAtom).length > 0);
export const tvSnapshotAtom = atom<SessionSnapshot | null>(null);
export const roundResultsAtom = atom<readonly RoundResult[]>([]);
export const latencyMsAtom = atom<number | null>(null);

export interface LinkService {
  start(): void;
  stop(): void;
  send(message: TeacherMessage): void;
  /** Notified whenever the TV reports a new session snapshot. */
  onSnapshot(listener: (snapshot: SessionSnapshot) => void): () => void;
  /** Every valid message from a TV, after the link has handled it. */
  onMessage(listener: (message: TvMessage) => void): () => void;
}

export interface LinkServiceOptions {
  readonly port: number;
  readonly appVersion: string;
  readonly heartbeatMs: number;
  readonly now: () => number;
}

const DEFAULTS: LinkServiceOptions = { port: DEFAULT_PORT, appVersion: '1.0.0', heartbeatMs: 2000, now: () => Date.now() };

export function createLinkService(server: LinkServer, store: Store, options: Partial<LinkServiceOptions> = {}): LinkService {
  const config = { ...DEFAULTS, ...options };
  const snapshotListeners = new Set<(snapshot: SessionSnapshot) => void>();
  const messageListeners = new Set<(message: TvMessage) => void>();
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const send = (message: TeacherMessage) => {
    if (store.get(tvConnectedAtom)) server.broadcast(encodeMessage(message));
  };

  const updateClient = (id: ClientId, update: (client: TvClient) => TvClient) =>
    store.set(tvClientsAtom, (clients) => clients.map((c) => (c.id === id ? update(c) : c)));

  const handle = (client: ClientId, message: TvMessage) => {
    switch (message.t) {
      case 'hello':
        updateClient(client, (c) => ({ ...c, platform: message.platform }));
        return;
      case 'state': {
        const { t: _type, ...snapshot } = message;
        const previous = store.get(tvSnapshotAtom);
        if (snapshot.phase === 'lobby' && previous?.phase !== 'lobby') store.set(roundResultsAtom, []);
        store.set(tvSnapshotAtom, snapshot);
        snapshotListeners.forEach((listener) => listener(snapshot));
        return;
      }
      case 'result':
        // One result per team per round (or one "time up" result with team null).
        store.set(roundResultsAtom, (results) => [...results.filter((r) => r.round !== message.round || r.team !== message.team), message]);
        return;
      case 'pong':
        store.set(latencyMsAtom, Math.max(0, config.now() - message.ts));
        return;
      case 'calib':
        return;
    }
  };

  return {
    start() {
      store.set(serverStatusAtom, { state: 'starting' });
      server.start(config.port, {
        onStatus: (status) => store.set(serverStatusAtom, status),
        onClientConnected: (id, address) => {
          store.set(tvClientsAtom, (clients) => [...clients, { id, address, platform: null }]);
          send({ t: 'hello', role: 'teacher', app: config.appVersion });
        },
        onClientDisconnected: (id) => {
          store.set(tvClientsAtom, (clients) => clients.filter((c) => c.id !== id));
          if (!store.get(tvConnectedAtom)) store.set(tvSnapshotAtom, null);
        },
        onText: (id, text) => {
          const decoded = decodeTvMessage(text);
          if (decoded.ok) {
            handle(id, decoded.message);
            messageListeners.forEach((listener) => listener(decoded.message));
          } else console.warn(`[link] ignored message from TV: ${decoded.error}`);
        },
      });
      heartbeat = setInterval(() => send({ t: 'ping', ts: config.now() }), config.heartbeatMs);
    },
    stop() {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      server.stop();
      store.set(tvClientsAtom, []);
      store.set(serverStatusAtom, { state: 'stopped' });
    },
    send,
    onSnapshot(listener) {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    onMessage(listener) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
  };
}
