/**
 * Minimal RFC 6455 WebSocket *server* codec.
 *
 * The phone is the hotspot, so it is the TV's default gateway: the TV opens a
 * standard `new WebSocket('ws://<gateway>:8787')` (built into React Native on
 * Fire OS *and* Vega OS), and the phone answers here over a raw TCP socket.
 * Only what this app needs is implemented: text frames, ping/pong, close,
 * and continuation frames for completeness. No extensions, no binary payloads.
 */
import { asciiDecode, base64Encode, concatBytes, sha1, utf8Decode, utf8Encode } from './bytes';

const HANDSHAKE_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const HEADER_END = '\r\n\r\n';
/** Hard cap so a misbehaving client cannot make the phone buffer unbounded data. */
export const MAX_MESSAGE_BYTES = 64 * 1024;

export function computeAcceptKey(clientKey: string): string {
  return base64Encode(sha1(utf8Encode(clientKey.trim() + HANDSHAKE_GUID)));
}

export type HandshakeResult =
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'rejected'; readonly response: string; readonly reason: string }
  | { readonly kind: 'accepted'; readonly response: string; readonly rest: Uint8Array };

/** Parses the HTTP upgrade request. Call again with more bytes while it returns `incomplete`. */
export function processHandshake(buffer: Uint8Array): HandshakeResult {
  const text = asciiDecode(buffer);
  const end = text.indexOf(HEADER_END);
  if (end === -1) {
    if (buffer.length > 8192) return reject(431, 'Request Header Fields Too Large', 'headers too large');
    return { kind: 'incomplete' };
  }
  const [requestLine = '', ...headerLines] = text.slice(0, end).split('\r\n');
  if (!/^GET\s+\S+\s+HTTP\/1\.1$/i.test(requestLine.trim())) return reject(400, 'Bad Request', 'not a GET request');

  const headers = new Map<string, string>();
  for (const line of headerLines) {
    const colon = line.indexOf(':');
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  const key = headers.get('sec-websocket-key');
  const upgrade = headers.get('upgrade')?.toLowerCase();
  if (upgrade !== 'websocket' || !key) return reject(426, 'Upgrade Required', 'missing websocket upgrade headers');

  const response =
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${computeAcceptKey(key)}\r\n\r\n`;
  return { kind: 'accepted', response, rest: buffer.slice(end + HEADER_END.length) };
}

function reject(status: number, statusText: string, reason: string): HandshakeResult {
  return { kind: 'rejected', reason, response: `HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\n\r\n` };
}

export const OPCODE = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;

export type WsEvent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'ping'; readonly payload: Uint8Array }
  | { readonly type: 'pong' }
  | { readonly type: 'close'; readonly code: number }
  | { readonly type: 'error'; readonly reason: string };

/**
 * Incremental decoder for frames sent by a client (always masked, per RFC 6455).
 * TCP delivers arbitrary chunks, so frames may be split or coalesced.
 */
export class FrameDecoder {
  private buffer: Uint8Array = new Uint8Array(0);
  private fragments: Uint8Array = new Uint8Array(0);
  private fragmenting = false;

  push(chunk: Uint8Array): WsEvent[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const events: WsEvent[] = [];
    for (;;) {
      const frame = this.readFrame();
      if (frame === null) break;
      if ('error' in frame) {
        events.push({ type: 'error', reason: frame.error });
        this.buffer = new Uint8Array(0);
        break;
      }
      const event = this.toEvent(frame);
      if (event) events.push(event);
    }
    return events;
  }

  private readFrame(): { fin: boolean; opcode: number; payload: Uint8Array } | { error: string } | null {
    const b = this.buffer;
    if (b.length < 2) return null;
    const fin = (b[0]! & 0x80) !== 0;
    const opcode = b[0]! & 0x0f;
    const masked = (b[1]! & 0x80) !== 0;
    if (!masked) return { error: 'client frames must be masked' };
    if ((b[0]! & 0x70) !== 0) return { error: 'extensions are not supported' };

    let length = b[1]! & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (b.length < 4) return null;
      length = (b[2]! << 8) | b[3]!;
      offset = 4;
    } else if (length === 127) {
      if (b.length < 10) return null;
      const high = ((b[2]! << 24) | (b[3]! << 16) | (b[4]! << 8) | b[5]!) >>> 0;
      if (high !== 0) return { error: 'frame too large' };
      length = ((b[6]! << 24) | (b[7]! << 16) | (b[8]! << 8) | b[9]!) >>> 0;
      offset = 10;
    }
    if (length > MAX_MESSAGE_BYTES) return { error: 'frame too large' };
    if (b.length < offset + 4 + length) return null;

    const mask = b.subarray(offset, offset + 4);
    const payload = new Uint8Array(length);
    for (let i = 0; i < length; i++) payload[i] = b[offset + 4 + i]! ^ mask[i & 3]!;
    this.buffer = b.slice(offset + 4 + length);
    return { fin, opcode, payload };
  }

  private toEvent(frame: { fin: boolean; opcode: number; payload: Uint8Array }): WsEvent | null {
    switch (frame.opcode) {
      case OPCODE.text:
      case OPCODE.continuation: {
        if (frame.opcode === OPCODE.continuation && !this.fragmenting) return { type: 'error', reason: 'unexpected continuation' };
        this.fragments = concatBytes(this.fragments, frame.payload);
        if (this.fragments.length > MAX_MESSAGE_BYTES) return { type: 'error', reason: 'message too large' };
        if (!frame.fin) {
          this.fragmenting = true;
          return null;
        }
        const text = utf8Decode(this.fragments);
        this.fragments = new Uint8Array(0);
        this.fragmenting = false;
        return { type: 'text', text };
      }
      case OPCODE.ping:
        return { type: 'ping', payload: frame.payload };
      case OPCODE.pong:
        return { type: 'pong' };
      case OPCODE.close:
        return { type: 'close', code: frame.payload.length >= 2 ? (frame.payload[0]! << 8) | frame.payload[1]! : 1005 };
      case OPCODE.binary:
        return { type: 'error', reason: 'binary frames are not supported' };
      default:
        return { type: 'error', reason: `unknown opcode ${frame.opcode}` };
    }
  }
}

/** Builds a server-to-client frame (servers never mask). */
export function encodeFrame(opcode: number, payload: Uint8Array): Uint8Array {
  const length = payload.length;
  const headerLength = length < 126 ? 2 : length < 65536 ? 4 : 10;
  const frame = new Uint8Array(headerLength + length);
  frame[0] = 0x80 | opcode;
  if (length < 126) {
    frame[1] = length;
  } else if (length < 65536) {
    frame[1] = 126;
    frame[2] = length >> 8;
    frame[3] = length & 0xff;
  } else {
    frame[1] = 127;
    new DataView(frame.buffer).setUint32(6, length);
  }
  frame.set(payload, headerLength);
  return frame;
}

export const encodeTextFrame = (text: string): Uint8Array => encodeFrame(OPCODE.text, utf8Encode(text));
export const encodePongFrame = (payload: Uint8Array): Uint8Array => encodeFrame(OPCODE.pong, payload);
export const encodeCloseFrame = (code = 1000): Uint8Array => encodeFrame(OPCODE.close, Uint8Array.from([code >> 8, code & 0xff]));
