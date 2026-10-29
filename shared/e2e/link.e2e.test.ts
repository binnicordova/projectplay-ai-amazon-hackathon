/**
 * End-to-end wire check on loopback:
 *   teacher LinkService + hand-written RFC 6455 server (over Node `net`)
 *   ⇄ TV LinkClient using Node's standards-compliant global WebSocket.
 */
import net from 'node:net';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SAMPLE_ART, SAMPLE_LESSON } from '@mimikai/contracts/src/testing/sampleLesson';
import { decodeLesson, type CalibrationPattern, type Lesson, type TeacherMessage } from '@mimikai/contracts';
import { startCommand } from '../../teacher/src/features/console/application/console';
import { TWEMOJI_ART } from '../../teacher/src/features/pictures/infrastructure/twemojiArt.generated';
import { INITIAL_SESSION, reduceSession, roundResults, snapshotOf, type SessionState } from '../../tv/packages/tv-shared/src/features/session/domain/session';
import { FrameDecoder, encodeCloseFrame, encodePongFrame, encodeTextFrame, processHandshake } from '../../teacher/src/features/link/domain/websocket';
import { createLinkService, latencyMsAtom, roundResultsAtom, tvClientsAtom, tvSnapshotAtom } from '../../teacher/src/features/link/application/linkService';
import type { LinkServer, LinkServerEvents } from '../../teacher/src/features/link/application/ports';
import { AutoCalibrator, autoCalibrationAtom } from '../../teacher/src/features/perception/application/autoCalibration';
import { calibrationAtom } from '../../teacher/src/features/perception/application/calibration';
import { LUMA_HEIGHT, LUMA_WIDTH } from '../../teacher/src/features/perception/domain/markers';
import { KEYSTONED, renderPattern } from '../../teacher/src/features/perception/domain/testing/syntheticProjection';
import { LinkClient, linkStatusAtom, type Transport } from '../../tv/packages/tv-shared/src/features/link/application/linkClient';

/** Same logic as teacher/src/features/link/infrastructure/tcpWebSocketServer.ts, on Node sockets. */
class NodeWebSocketServer implements LinkServer {
  private server: net.Server | null = null;
  private clients = new Map<number, { socket: net.Socket; upgraded: boolean }>();
  private next = 1;
  start(port: number, events: LinkServerEvents) {
    this.server = net.createServer((socket) => {
      const id = this.next++;
      const client = { socket, upgraded: false };
      this.clients.set(id, client);
      let pending = new Uint8Array(0);
      const decoder = new FrameDecoder();
      const handle = (bytes: Uint8Array) => {
        for (const e of decoder.push(bytes)) {
          if (e.type === 'text') events.onText(id, e.text);
          else if (e.type === 'ping') socket.write(encodePongFrame(e.payload));
          else if (e.type === 'close' || e.type === 'error') {
            socket.write(encodeCloseFrame());
            socket.destroy();
          }
        }
      };
      socket.on('data', (data) => {
        const bytes = new Uint8Array(data);
        if (client.upgraded) return handle(bytes);
        const merged = new Uint8Array([...pending, ...bytes]);
        const r = processHandshake(merged);
        if (r.kind === 'incomplete') return void (pending = merged);
        if (r.kind === 'rejected') return void socket.end(r.response);
        socket.write(r.response);
        client.upgraded = true;
        events.onClientConnected(id, socket.remoteAddress ?? '?');
        if (r.rest.length) handle(r.rest);
      });
      socket.on('close', () => {
        if (this.clients.delete(id) && client.upgraded) events.onClientDisconnected(id);
      });
      socket.on('error', () => {});
    });
    this.server.listen(port, '127.0.0.1', () => events.onStatus({ state: 'listening', port }));
  }
  stop() {
    this.clients.forEach((c) => c.socket.destroy());
    this.server?.close();
  }
  broadcast(text: string) {
    const frame = encodeTextFrame(text);
    this.clients.forEach((c) => c.upgraded && c.socket.write(frame));
  }
}

const nodeWebSocketTransport: Transport = {
  connect(url, handlers) {
    const ws = new WebSocket(url);
    ws.onopen = () => handlers.onOpen();
    ws.onmessage = (e) => typeof e.data === 'string' && handlers.onText(e.data);
    ws.onclose = () => handlers.onClose();
    ws.onerror = () => {};
    return { send: (t) => ws.readyState === WebSocket.OPEN && ws.send(t), close: () => ws.close() };
  },
};

const until = async (check: () => boolean, ms = 4000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe('phone ⇄ TV over a real WebSocket', () => {
  it('discovers, greets, mirrors state (one player), streams pointers and measures latency', async () => {
    const port = 18787;
    const phoneStore = createStore();
    const phone = createLinkService(new NodeWebSocketServer(), phoneStore, { port, heartbeatMs: 200 });
    phone.start();

    const tvStore = createStore();
    const tv = new LinkClient(nodeWebSocketTransport, { ownIpAddress: async () => null }, tvStore, {
      port,
      platform: 'e2e-tv',
      preferredHosts: ['127.0.0.1'],
    });
    const received: TeacherMessage[] = [];
    tv.onMessage((m) => received.push(m));
    tv.start();

    await until(() => tvStore.get(linkStatusAtom).state === 'connected');
    await until(() => phoneStore.get(tvClientsAtom)[0]?.platform === 'e2e-tv');

    phone.send({ t: 'ctl', a: 'start', config: { lesson: SAMPLE_LESSON, art: SAMPLE_ART, rounds: 3, seed: 1, teams: 1 } });
    for (let i = 0; i < 30; i++) phone.send({ t: 'ptr', p: 1, x: i / 30, y: 0.5, c: 0.9 });
    await until(() => received.filter((m) => m.t === 'ptr').length === 30);
    expect(received.find((m) => m.t === 'ctl')).toMatchObject({ a: 'start', config: { teams: 1 } });

    tv.send({ t: 'state', phase: 'question', round: 1, rounds: 3, mode: 'choice', prompt: '¿2 + 3 = ?', scores: { A: 0, B: 0 }, teams: 1 });
    await until(() => phoneStore.get(tvSnapshotAtom)?.prompt === '¿2 + 3 = ?');
    expect(phoneStore.get(tvSnapshotAtom)?.teams).toBe(1);
    await until(() => phoneStore.get(latencyMsAtom) !== null);
    expect(phoneStore.get(latencyMsAtom)).toBeLessThan(100);

    tv.stop();
    await until(() => phoneStore.get(tvClientsAtom).length === 0);
    phone.stop();
  });

  it('plays a starter lesson: the whole file and its pictures cross the wire, the TV runs it from memory', async () => {
    const port = 18789;
    const phoneStore = createStore();
    const phone = createLinkService(new NodeWebSocketServer(), phoneStore, { port, heartbeatMs: 200 });
    phone.start();
    const tvStore = createStore();
    const tv = new LinkClient(nodeWebSocketTransport, { ownIpAddress: async () => null }, tvStore, { port, platform: 'e2e-tv', preferredHosts: ['127.0.0.1'] });
    let session: SessionState = INITIAL_SESSION;
    tv.onMessage((m) => {
      if (m.t !== 'ctl' || m.a !== 'start') return;
      session = reduceSession(session, { type: 'start', config: m.config, now: 0 });
      tv.send({ t: 'state', ...snapshotOf(session) });
    });
    tv.start();
    await until(() => phoneStore.get(tvClientsAtom).length > 0);

    const file = readFileSync(path.resolve(__dirname, '../../teacher/assets/lessons/silabas-granja.json'), 'utf8');
    const lesson = decodeLesson(JSON.parse(file));
    expect(lesson.ok).toBe(true);
    const start = startCommand({ lesson: (lesson as { value: Lesson }).value, library: TWEMOJI_ART, rounds: 10, teams: 2, record: 900 });
    phone.send(start);

    await until(() => phoneStore.get(tvSnapshotAtom)?.lessonId === 'silabas-granja');
    expect(session.phase).toBe('question');
    if (session.phase !== 'question') return;
    // Only the pictures the lesson shows (plus the game icons) travel, as SVG.
    expect(Object.keys(session.config.art).length).toBeGreaterThan(5);
    expect(Object.values(session.config.art).every((svg) => svg.startsWith('<svg'))).toBe(true);
    expect(session.config.lesson).toEqual((lesson as { value: Lesson }).value);
    expect(session.config.record).toBe(900);
    expect(phoneStore.get(tvSnapshotAtom)).toMatchObject({ phase: 'question', round: 1, rounds: 10, level: 1, teams: 2 });
    expect(phoneStore.get(tvSnapshotAtom)?.say).toBeTruthy();

    // A round is played on the TV; the phone gets each team's result with its points.
    const card = session.round.card;
    const right = card.kind === 'choice' ? card.answer : 0;
    session = reduceSession(session, { type: 'answer', team: 'A', value: right, now: 1500 });
    session = reduceSession(session, { type: 'next', now: 2000 });
    roundResults(session).forEach((r) => tv.send(r));
    await until(() => phoneStore.get(roundResultsAtom).length === 1);
    expect(phoneStore.get(roundResultsAtom)[0]).toMatchObject({ team: 'A', correct: true });
    expect(phoneStore.get(roundResultsAtom)[0]?.points).toBeGreaterThan(100);

    tv.stop();
    phone.stop();
  });

  it('calibrates automatically: the TV shows markers, a simulated camera films them', async () => {
    const port = 18788;
    const phoneStore = createStore();
    const phone = createLinkService(new NodeWebSocketServer(), phoneStore, { port, heartbeatMs: 200 });
    const calibrator = new AutoCalibrator({ store: phoneStore, send: phone.send, isTvConnected: () => phoneStore.get(tvClientsAtom).length > 0 });
    phone.onMessage((m) => m.t === 'calib' && calibrator.onPatternShown(m.shown));
    phone.start();

    // The TV: show what the phone asks for and confirm it (like CalibrationPatternLayer).
    const tvStore = createStore();
    const tv = new LinkClient(nodeWebSocketTransport, { ownIpAddress: async () => null }, tvStore, {
      port,
      platform: 'e2e-tv',
      preferredHosts: ['127.0.0.1'],
    });
    let onScreen: CalibrationPattern | null = null;
    tv.onMessage((m) => {
      if (m.t !== 'calib') return;
      onScreen = m.show;
      if (m.show) setTimeout(() => tv.send({ t: 'calib', shown: m.show }), 30);
    });
    tv.start();
    await until(() => phoneStore.get(tvClientsAtom).length > 0);

    // The camera: 30 fps of whatever the projector currently shows.
    const frames = { corners: renderPattern('corners'), dark: renderPattern('dark'), center: renderPattern('center') };
    const camera = setInterval(() => {
      const scene = frames[onScreen ?? 'dark'];
      calibrator.onLumaFrame({ luma: Uint8Array.from(scene, (v) => Math.round(v)), width: LUMA_WIDTH, height: LUMA_HEIGHT });
    }, 33);

    calibrator.start();
    await until(() => phoneStore.get(autoCalibrationAtom).state !== 'running', 8000);
    clearInterval(camera);
    expect(phoneStore.get(autoCalibrationAtom)).toMatchObject({ state: 'done' });
    await until(() => onScreen === null);
    phoneStore.get(calibrationAtom)!.forEach((p, i) => expect(Math.hypot(p.x - KEYSTONED[i]!.x, p.y - KEYSTONED[i]!.y)).toBeLessThan(0.005));

    tv.stop();
    phone.stop();
  }, 15000);
});
