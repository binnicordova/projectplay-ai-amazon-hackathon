/**
 * Connects the TV to the teacher's phone and keeps it connected.
 * Discovery races small batches of WebSocket connections over the candidate hosts;
 * the first host that greets us as a teacher wins. A silent link (no heartbeat)
 * is torn down and rediscovered, so unplugging the phone never freezes the TV.
 */
import {
  DEFAULT_PORT,
  decodeTeacherMessage,
  encodeMessage,
  type TeacherMessage,
  type TvMessage,
} from '@projectplay/contracts';
import { atom, type createStore } from 'jotai';
import { candidateHosts, teacherUrl } from '../domain/discovery';

type Store = ReturnType<typeof createStore>;

/** Port: a minimal WebSocket. The adapter wraps React Native's built-in WebSocket. */
export interface Connection {
  send(text: string): void;
  close(): void;
}

export interface ConnectionHandlers {
  onOpen(): void;
  onText(text: string): void;
  onClose(): void;
}

export interface Transport {
  connect(url: string, handlers: ConnectionHandlers): Connection;
}

/** Port: the TV's own IP on the hotspot, if the platform can tell. */
export interface NetworkInfo {
  ownIpAddress(): Promise<string | null>;
}

export type LinkStatus =
  | { readonly state: 'searching'; readonly attempt: number }
  | { readonly state: 'connected'; readonly host: string }
  | { readonly state: 'offline'; readonly reason: string };

export const linkStatusAtom = atom<LinkStatus>({ state: 'searching', attempt: 0 });

export interface LinkClientOptions {
  readonly port: number;
  readonly platform: string;
  /** Hosts to try first, e.g. a developer override like EXPO_PUBLIC_TEACHER_HOST. */
  readonly preferredHosts: readonly string[];
  readonly batchSize: number;
  readonly connectTimeoutMs: number;
  /** Consider the link dead if the phone is silent this long (it pings every 2 s). */
  readonly silenceTimeoutMs: number;
  readonly retryDelayMs: number;
}

const DEFAULTS: LinkClientOptions = {
  port: DEFAULT_PORT,
  platform: 'tv',
  preferredHosts: [],
  batchSize: 16,
  connectTimeoutMs: 1500,
  silenceTimeoutMs: 6000,
  retryDelayMs: 1500,
};

export class LinkClient {
  private readonly options: LinkClientOptions;
  private readonly listeners = new Set<(message: TeacherMessage) => void>();
  private active: Connection | null = null;
  private lastGoodHost: string | null = null;
  private running = false;
  private generation = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly transport: Transport,
    private readonly network: NetworkInfo,
    private readonly store: Store,
    options: Partial<LinkClientOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  onMessage(listener: (message: TeacherMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: TvMessage): void {
    this.active?.send(encodeMessage(message));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.discover(1);
  }

  stop(): void {
    this.running = false;
    this.generation++;
    this.clearTimers();
    this.active?.close();
    this.active = null;
  }

  private clearTimers(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.silenceTimer = null;
    this.retryTimer = null;
  }

  private async discover(attempt: number): Promise<void> {
    const generation = ++this.generation;
    this.store.set(linkStatusAtom, { state: 'searching', attempt });
    const ownIp = await this.network.ownIpAddress().catch(() => null);
    const preferred = [...this.options.preferredHosts, ...(this.lastGoodHost ? [this.lastGoodHost] : [])];
    const hosts = candidateHosts(ownIp, preferred);

    for (let i = 0; i < hosts.length && this.isCurrent(generation); i += this.options.batchSize) {
      const winner = await this.raceBatch(hosts.slice(i, i + this.options.batchSize), generation);
      if (winner) return;
    }
    if (!this.isCurrent(generation)) return;
    this.store.set(linkStatusAtom, { state: 'offline', reason: 'Teacher phone not found on this network yet' });
    this.retryTimer = setTimeout(() => void this.discover(attempt + 1), this.options.retryDelayMs);
  }

  private isCurrent(generation: number): boolean {
    return this.running && generation === this.generation;
  }

  /** Opens one socket per host; keeps the first that says hello as a teacher, closes the rest. */
  private raceBatch(hosts: readonly string[], generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      let pending = hosts.length;
      let settled = false;
      const sockets: Connection[] = [];
      const finishOne = () => {
        pending--;
        if (pending === 0 && !settled) {
          settled = true;
          resolve(false);
        }
      };
      if (pending === 0) return resolve(false);

      hosts.forEach((host) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          socket.close();
          finishOne();
        }, this.options.connectTimeoutMs);

        const socket = this.transport.connect(teacherUrl(host, this.options.port), {
          onOpen: () => {},
          onText: (text) => {
            if (settled) {
              if (this.active === socket) this.receive(text);
              return;
            }
            const decoded = decodeTeacherMessage(text);
            if (!decoded.ok || decoded.message.t !== 'hello' || !this.isCurrent(generation)) return;
            done = true;
            settled = true;
            clearTimeout(timeout);
            sockets.filter((s) => s !== socket).forEach((s) => s.close());
            this.adopt(socket, host, generation);
            resolve(true);
          },
          onClose: () => {
            if (this.active === socket) this.handleDisconnect(generation);
            if (done) return;
            done = true;
            clearTimeout(timeout);
            finishOne();
          },
        });
        sockets.push(socket);
      });
    });
  }

  private adopt(connection: Connection, host: string, generation: number): void {
    this.active = connection;
    this.lastGoodHost = host;
    this.store.set(linkStatusAtom, { state: 'connected', host });
    connection.send(encodeMessage({ t: 'hello', role: 'tv', platform: this.options.platform }));
    this.armSilenceTimer(generation);
  }

  private receive(text: string): void {
    this.armSilenceTimer(this.generation);
    const decoded = decodeTeacherMessage(text);
    if (!decoded.ok) return;
    if (decoded.message.t === 'ping') this.send({ t: 'pong', ts: decoded.message.ts });
    this.listeners.forEach((listener) => listener(decoded.message));
  }

  private armSilenceTimer(generation: number): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (!this.isCurrent(generation)) return;
      this.active?.close();
      this.handleDisconnect(generation);
    }, this.options.silenceTimeoutMs);
  }

  private handleDisconnect(generation: number): void {
    if (!this.isCurrent(generation) || this.active === null) return;
    this.active = null;
    this.clearTimers();
    this.retryTimer = setTimeout(() => void this.discover(1), this.options.retryDelayMs);
    this.store.set(linkStatusAtom, { state: 'searching', attempt: 1 });
  }
}
