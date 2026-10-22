import { describe, expect, it } from 'vitest';
import { base64Encode, sha1, utf8Decode, utf8Encode } from './bytes';
import {
  FrameDecoder,
  MAX_MESSAGE_BYTES,
  OPCODE,
  computeAcceptKey,
  encodeTextFrame,
  processHandshake,
} from './websocket';

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Builds a masked client frame, the way a browser / React Native WebSocket would. */
function clientFrame(opcode: number, payload: Uint8Array, fin = true, mask = [0x37, 0xfa, 0x21, 0x3d]): Uint8Array {
  const length = payload.length;
  const header: number[] = [(fin ? 0x80 : 0) | opcode];
  if (length < 126) header.push(0x80 | length);
  else if (length < 65536) header.push(0x80 | 126, length >> 8, length & 0xff);
  else header.push(0x80 | 127, 0, 0, 0, 0, (length >>> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff);
  const out = new Uint8Array(header.length + 4 + length);
  out.set(header, 0);
  out.set(mask, header.length);
  for (let i = 0; i < length; i++) out[header.length + 4 + i] = payload[i]! ^ mask[i & 3]!;
  return out;
}

describe('bytes', () => {
  it('computes SHA-1 test vectors', () => {
    expect(hex(sha1(utf8Encode('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(hex(sha1(new Uint8Array(0)))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(hex(sha1(utf8Encode('a'.repeat(1000))))).toBe('291e9a6c66994949b57ba5e650361e98fc36b1ba');
  });

  it('base64-encodes with padding', () => {
    expect(base64Encode(utf8Encode('Ma'))).toBe('TWE=');
    expect(base64Encode(utf8Encode('M'))).toBe('TQ==');
    expect(base64Encode(utf8Encode('Man'))).toBe('TWFu');
  });

  it('round-trips UTF-8 including accents and emoji', () => {
    for (const text of ['hola', '¿Cuánto es 7 + 8?', '× ÷ − √', 'great 🎉 job']) {
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    }
  });
});

describe('handshake', () => {
  it('produces the RFC 6455 sample accept key', () => {
    expect(computeAcceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });

  const request =
    'GET / HTTP/1.1\r\nHost: 192.168.43.1:8787\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n';

  it('waits for the full header block', () => {
    expect(processHandshake(utf8Encode(request.slice(0, 40))).kind).toBe('incomplete');
  });

  it('accepts a valid upgrade and keeps trailing bytes', () => {
    const trailing = clientFrame(OPCODE.text, utf8Encode('hi'));
    const buffer = new Uint8Array([...utf8Encode(request), ...trailing]);
    const result = processHandshake(buffer);
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    expect(result.response).toContain('101 Switching Protocols');
    expect(result.response).toContain('Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
    expect(Array.from(result.rest)).toEqual(Array.from(trailing));
  });

  it('rejects plain HTTP requests', () => {
    const result = processHandshake(utf8Encode('GET / HTTP/1.1\r\nHost: x\r\n\r\n'));
    expect(result.kind).toBe('rejected');
  });
});

describe('FrameDecoder', () => {
  it('decodes a masked text frame', () => {
    const decoder = new FrameDecoder();
    expect(decoder.push(clientFrame(OPCODE.text, utf8Encode('{"v":1}')))).toEqual([{ type: 'text', text: '{"v":1}' }]);
  });

  it('handles frames split across TCP chunks and coalesced frames', () => {
    const decoder = new FrameDecoder();
    const a = clientFrame(OPCODE.text, utf8Encode('first'));
    const b = clientFrame(OPCODE.text, utf8Encode('second'));
    const stream = new Uint8Array([...a, ...b]);
    const events = [...decoder.push(stream.subarray(0, 3)), ...decoder.push(stream.subarray(3, 9)), ...decoder.push(stream.subarray(9))];
    expect(events).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ]);
  });

  it('decodes 16-bit payload lengths', () => {
    const text = 'x'.repeat(300);
    expect(new FrameDecoder().push(clientFrame(OPCODE.text, utf8Encode(text)))).toEqual([{ type: 'text', text }]);
  });

  it('reassembles fragmented messages', () => {
    const decoder = new FrameDecoder();
    const events = [
      ...decoder.push(clientFrame(OPCODE.text, utf8Encode('hel'), false)),
      ...decoder.push(clientFrame(OPCODE.continuation, utf8Encode('lo'), true)),
    ];
    expect(events).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('surfaces ping, pong and close control frames', () => {
    const decoder = new FrameDecoder();
    const events = decoder.push(
      new Uint8Array([
        ...clientFrame(OPCODE.ping, Uint8Array.from([1, 2])),
        ...clientFrame(OPCODE.pong, new Uint8Array(0)),
        ...clientFrame(OPCODE.close, Uint8Array.from([0x03, 0xe8])),
      ]),
    );
    expect(events).toEqual([{ type: 'ping', payload: Uint8Array.from([1, 2]) }, { type: 'pong' }, { type: 'close', code: 1000 }]);
  });

  it('rejects unmasked and oversized frames', () => {
    expect(new FrameDecoder().push(Uint8Array.from([0x81, 0x02, 0x68, 0x69]))[0]?.type).toBe('error');
    const huge = clientFrame(OPCODE.text, new Uint8Array(MAX_MESSAGE_BYTES + 1));
    expect(new FrameDecoder().push(huge)[0]?.type).toBe('error');
  });
});

describe('server frames', () => {
  it('encodes short and medium text frames without a mask', () => {
    expect(Array.from(encodeTextFrame('hi'))).toEqual([0x81, 0x02, 0x68, 0x69]);
    const medium = encodeTextFrame('y'.repeat(200));
    expect(medium[1]).toBe(126);
    expect((medium[2]! << 8) | medium[3]!).toBe(200);
    expect(medium.length).toBe(204);
  });
});
