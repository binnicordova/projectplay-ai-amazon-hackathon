/**
 * LinkServer adapter: a WebSocket server on top of react-native-tcp-socket.
 * The phone hosts the hotspot, so every TV on it can reach this server at the
 * phone's gateway address, with no school Wi-Fi and no internet.
 */
import TcpSocket from 'react-native-tcp-socket';
import { utf8Encode } from '../domain/bytes';
import { FrameDecoder, encodeCloseFrame, encodePongFrame, encodeTextFrame, processHandshake } from '../domain/websocket';
import type { ClientId, LinkServer, LinkServerEvents } from '../application/ports';

type TcpServer = InstanceType<typeof TcpSocket.Server>;
type TcpConnection = InstanceType<typeof TcpSocket.Socket>;

interface Client {
  readonly socket: TcpConnection;
  upgraded: boolean;
  pending: Uint8Array;
  readonly decoder: FrameDecoder;
}

const toBytes = (data: string | Uint8Array): Uint8Array => (typeof data === 'string' ? utf8Encode(data) : new Uint8Array(data));

export class TcpWebSocketServer implements LinkServer {
  private server: TcpServer | null = null;
  private readonly clients = new Map<ClientId, Client>();
  private nextId: ClientId = 1;

  start(port: number, events: LinkServerEvents): void {
    this.stop();
    const server = TcpSocket.createServer({ noDelay: true, keepAlive: true }, (socket) => this.accept(socket, events));
    server.on('error', (error) => events.onStatus({ state: 'error', message: error.message }));
    server.on('close', () => events.onStatus({ state: 'stopped' }));
    server.listen({ port, host: '0.0.0.0', reuseAddress: true }, () => events.onStatus({ state: 'listening', port }));
    this.server = server;
  }

  stop(): void {
    this.clients.forEach((client) => client.socket.destroy());
    this.clients.clear();
    this.server?.close();
    this.server = null;
  }

  broadcast(text: string): void {
    const frame = encodeTextFrame(text);
    this.clients.forEach((client) => {
      if (client.upgraded) client.socket.write(frame);
    });
  }

  private accept(socket: TcpConnection, events: LinkServerEvents): void {
    const id = this.nextId++;
    const client: Client = { socket, upgraded: false, pending: new Uint8Array(0), decoder: new FrameDecoder() };
    this.clients.set(id, client);

    const drop = () => {
      if (!this.clients.delete(id)) return;
      if (client.upgraded) events.onClientDisconnected(id);
    };

    socket.on('data', (data) => {
      const bytes = toBytes(data);
      if (!client.upgraded) {
        const merged = new Uint8Array(client.pending.length + bytes.length);
        merged.set(client.pending);
        merged.set(bytes, client.pending.length);
        const result = processHandshake(merged);
        if (result.kind === 'incomplete') {
          client.pending = merged;
          return;
        }
        if (result.kind === 'rejected') {
          socket.write(result.response);
          socket.destroy();
          drop();
          return;
        }
        socket.write(result.response);
        client.upgraded = true;
        client.pending = new Uint8Array(0);
        events.onClientConnected(id, socket.remoteAddress ?? 'unknown');
        if (result.rest.length === 0) return;
        this.handleFrames(id, client, result.rest, events, drop);
        return;
      }
      this.handleFrames(id, client, bytes, events, drop);
    });
    socket.on('error', drop);
    socket.on('close', drop);
  }

  private handleFrames(id: ClientId, client: Client, bytes: Uint8Array, events: LinkServerEvents, drop: () => void): void {
    for (const event of client.decoder.push(bytes)) {
      switch (event.type) {
        case 'text':
          events.onText(id, event.text);
          break;
        case 'ping':
          client.socket.write(encodePongFrame(event.payload));
          break;
        case 'pong':
          break;
        case 'close':
        case 'error':
          client.socket.write(encodeCloseFrame(event.type === 'close' ? 1000 : 1002));
          client.socket.destroy();
          drop();
          return;
      }
    }
  }
}
