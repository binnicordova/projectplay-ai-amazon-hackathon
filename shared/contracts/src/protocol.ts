/**
 * Wire protocol between the teacher phone (WebSocket server, hotspot host)
 * and the TV app (WebSocket client).
 *
 * Design rules:
 * - The phone only reports *what the body did*: where each raised hand points on the wall.
 *   The TV owns the screen layout, so it decides what a pointer means (hit-testing, dwell).
 * - Every message is a small JSON text frame: `{ "v": 1, "t": "<type>", ...payload }`.
 * - Decoders never throw: they return `{ ok: false, error }` for anything malformed,
 *   so a bad frame can never crash the classroom session.
 * - Zero runtime dependencies on purpose: this file is bundled by Expo (RN 0.81/0.85)
 *   *and* the Vega SDK toolchain (RN 0.72), so it stays plain TypeScript.
 */
import { CALIBRATION_PATTERNS, type CalibrationPattern } from './calibration';
import {
  GAME_MODES,
  SESSION_PHASES,
  TEAMS,
  isOneOf,
  type GameMode,
  type PlayerId,
  type Scores,
  type SessionPhase,
  type TeamCount,
  type TeamId,
} from './domain';
import { LEVELS, decodeLesson, type IconId, type Lesson, type Level } from './lesson';

/** 2: classes play lesson files sent by the phone (1 generated arithmetic on the TV). */
export const PROTOCOL_VERSION = 2 as const;
/** TCP port the teacher phone listens on. */
export const DEFAULT_PORT = 8787;
/** Pointer coordinates may drift slightly outside the projection while a hand moves in/out. */
export const POINTER_MARGIN = 0.25;

/** 0 = the child's left hand, 1 = the right hand (or a lone pointer). */
export type HandId = 0 | 1;

// ---------------------------------------------------------------------------
// Messages: teacher phone -> TV
// ---------------------------------------------------------------------------

/** Art for the icons a lesson shows: SVG markup by icon id. The TV keeps it in memory only. */
export type IconArt = Readonly<Record<IconId, string>>;

export interface SessionConfig {
  /** The whole lesson travels with the start command: the TV stores nothing. */
  readonly lesson: Lesson;
  readonly art: IconArt;
  /** How many cards to play (the TV picks them by level as the class plays). */
  readonly rounds: number;
  /** Seed for picking and shuffling cards, so a class can be replayed exactly. */
  readonly seed: number;
  /** One player on the whole wall, or two teams on its halves. Absent = 2. */
  readonly teams?: TeamCount;
  /** Best score so far on this lesson, kept on the phone: the score to beat. */
  readonly record?: number;
}

export type TeacherCommand =
  | { readonly a: 'start'; readonly config: SessionConfig }
  | { readonly a: 'next' }
  | { readonly a: 'end' };

export type TeacherMessage =
  | { readonly t: 'hello'; readonly role: 'teacher'; readonly app: string }
  /**
   * A tracked hand, in projection space. `h` tells a child's two hands apart (0 or 1),
   * so either hand can answer. `c` is tracking confidence 0..1.
   */
  | { readonly t: 'ptr'; readonly p: PlayerId; readonly h?: HandId; readonly x: number; readonly y: number; readonly c: number }
  /** A player left the camera view (or tracking was lost). */
  | { readonly t: 'lost'; readonly p: PlayerId }
  | ({ readonly t: 'ctl' } & TeacherCommand)
  /** Show a calibration pattern full screen on top of everything (null = hide it). */
  | { readonly t: 'calib'; readonly show: CalibrationPattern | null }
  | { readonly t: 'ping'; readonly ts: number };

// ---------------------------------------------------------------------------
// Messages: TV -> teacher phone
// ---------------------------------------------------------------------------

export interface SessionSnapshot {
  readonly phase: SessionPhase;
  readonly round: number;
  readonly rounds: number;
  readonly mode: GameMode | null;
  /** Human-readable prompt currently on screen, e.g. "¿Con qué letra empieza? · rana". */
  readonly prompt: string | null;
  /** Points per team. */
  readonly scores: Scores;
  /** Teams in the running (or finished) session; absent in the lobby. */
  readonly teams?: TeamCount;
  /** The lesson being played and the class's current level in it. */
  readonly lessonId?: string;
  readonly level?: Level;
  /** What the teacher should read aloud for the card on screen (pre-readers). */
  readonly say?: string;
}

export type TvMessage =
  | { readonly t: 'hello'; readonly role: 'tv'; readonly platform: string }
  | ({ readonly t: 'state' } & SessionSnapshot)
  | {
      readonly t: 'result';
      readonly round: number;
      readonly correct: boolean;
      /** Team that answered, or null when time ran out. */
      readonly team: TeamId | null;
      readonly ms: number;
      /** Points the team earned this round. */
      readonly points?: number;
    }
  /** Sent once a calibration pattern is actually on screen, so the phone knows when to film. */
  | { readonly t: 'calib'; readonly shown: CalibrationPattern | null }
  | { readonly t: 'pong'; readonly ts: number };

export type MessageType = TeacherMessage['t'] | TvMessage['t'];

export type DecodeResult<T> = { readonly ok: true; readonly message: T } | { readonly ok: false; readonly error: string };

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export function encodeMessage(message: TeacherMessage | TvMessage): string {
  if (message.t === 'ptr') {
    // Pointers are the only high-frequency message: trim float noise to keep frames tiny.
    return JSON.stringify({ v: PROTOCOL_VERSION, ...message, x: round3(message.x), y: round3(message.y), c: round3(message.c) });
  }
  return JSON.stringify({ v: PROTOCOL_VERSION, ...message });
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

class DecodeError extends Error {}

function fail(reason: string): never {
  throw new DecodeError(reason);
}

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function num(obj: Json, key: string, min = -Infinity, max = Infinity): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`"${key}" must be a finite number`);
  if (value < min || value > max) fail(`"${key}" out of range [${min}, ${max}]`);
  return value;
}

function int(obj: Json, key: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const value = num(obj, key, min, max);
  if (!Number.isInteger(value)) fail(`"${key}" must be an integer`);
  return value;
}

function str(obj: Json, key: string, maxLength = 200): string {
  const value = obj[key];
  if (typeof value !== 'string') fail(`"${key}" must be a string`);
  if (value.length > maxLength) fail(`"${key}" is too long`);
  return value;
}

function bool(obj: Json, key: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') fail(`"${key}" must be a boolean`);
  return value;
}

function oneOf<T extends string>(obj: Json, key: string, values: readonly T[]): T {
  const value = obj[key];
  if (!isOneOf(values, value)) fail(`"${key}" must be one of ${values.join(', ')}`);
  return value;
}

function nullable<T>(obj: Json, key: string, read: (o: Json, k: string) => T): T | null {
  return obj[key] === null ? null : read(obj, key);
}

const playerId = (obj: Json): PlayerId => int(obj, 'p', 0, 1000);

/** The optional team count: left out when absent, so older messages decode exactly as before. */
const optionalTeams = (obj: Json): { teams?: TeamCount } => (obj.teams === undefined ? {} : { teams: int(obj, 'teams', 1, 2) as TeamCount });

const ICON_KEY = /^[0-9a-f]{2,6}(-[0-9a-f]{2,6}){0,6}$/;
const MAX_ART_ICONS = 160;
const MAX_SVG_CHARS = 24_000;

function iconArt(value: unknown): IconArt {
  if (!isRecord(value)) fail('"art" must be an object');
  const entries = Object.entries(value);
  if (entries.length > MAX_ART_ICONS) fail('"art" has too many icons');
  for (const [icon, svg] of entries) {
    if (!ICON_KEY.test(icon)) fail(`"art" has an invalid icon id "${icon}"`);
    if (typeof svg !== 'string' || !svg.startsWith('<svg') || svg.length > MAX_SVG_CHARS) fail(`"art.${icon}" must be SVG markup`);
  }
  return value as IconArt;
}

function sessionConfig(value: unknown): SessionConfig {
  if (!isRecord(value)) fail('"config" must be an object');
  const lesson = decodeLesson(value.lesson);
  if (!lesson.ok) fail(`"lesson": ${lesson.error}`);
  return {
    lesson: lesson.value,
    art: iconArt(value.art),
    rounds: int(value, 'rounds', 1, 40),
    seed: int(value, 'seed', 0, 2 ** 32 - 1),
    ...optionalTeams(value),
    ...(value.record === undefined ? {} : { record: int(value, 'record', 0, 1_000_000) }),
  };
}

function scores(value: unknown): Scores {
  if (!isRecord(value)) fail('"scores" must be an object');
  return { A: int(value, 'A', 0, 1_000_000), B: int(value, 'B', 0, 1_000_000) };
}

function parseEnvelope(text: string): Json {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail('not valid JSON');
  }
  if (!isRecord(parsed)) fail('message must be a JSON object');
  if (parsed.v !== PROTOCOL_VERSION) fail(`unsupported protocol version ${String(parsed.v)}`);
  if (typeof parsed.t !== 'string') fail('missing message type "t"');
  return parsed;
}

function readTeacherMessage(o: Json): TeacherMessage {
  switch (o.t) {
    case 'hello':
      if (o.role !== 'teacher') fail('"role" must be "teacher"');
      return { t: 'hello', role: 'teacher', app: str(o, 'app', 40) };
    case 'ptr':
      return {
        t: 'ptr',
        p: playerId(o),
        ...(o.h === undefined ? {} : { h: int(o, 'h', 0, 1) as HandId }),
        x: num(o, 'x', -POINTER_MARGIN, 1 + POINTER_MARGIN),
        y: num(o, 'y', -POINTER_MARGIN, 1 + POINTER_MARGIN),
        c: num(o, 'c', 0, 1),
      };
    case 'lost':
      return { t: 'lost', p: playerId(o) };
    case 'ctl': {
      const a = oneOf(o, 'a', ['start', 'next', 'end'] as const);
      return a === 'start' ? { t: 'ctl', a, config: sessionConfig(o.config) } : { t: 'ctl', a };
    }
    case 'calib':
      return { t: 'calib', show: nullable(o, 'show', (obj, k) => oneOf(obj, k, CALIBRATION_PATTERNS)) };
    case 'ping':
      return { t: 'ping', ts: num(o, 'ts', 0) };
    default:
      return fail(`unknown teacher message type "${String(o.t)}"`);
  }
}

function readTvMessage(o: Json): TvMessage {
  switch (o.t) {
    case 'hello':
      if (o.role !== 'tv') fail('"role" must be "tv"');
      return { t: 'hello', role: 'tv', platform: str(o, 'platform', 40) };
    case 'state':
      return {
        t: 'state',
        phase: oneOf(o, 'phase', SESSION_PHASES),
        round: int(o, 'round', 0, 40),
        rounds: int(o, 'rounds', 0, 40),
        mode: nullable(o, 'mode', (obj, k) => oneOf(obj, k, GAME_MODES)),
        prompt: nullable(o, 'prompt', (obj, k) => str(obj, k, 300)),
        scores: scores(o.scores),
        ...optionalTeams(o),
        ...(o.lessonId === undefined ? {} : { lessonId: str(o, 'lessonId', 60) }),
        ...(o.level === undefined ? {} : { level: int(o, 'level', LEVELS[0], LEVELS[LEVELS.length - 1]) as Level }),
        ...(o.say === undefined ? {} : { say: str(o, 'say', 200) }),
      };
    case 'result':
      return {
        t: 'result',
        round: int(o, 'round', 1, 40),
        correct: bool(o, 'correct'),
        team: nullable(o, 'team', (obj, k) => oneOf(obj, k, TEAMS)),
        ms: int(o, 'ms', 0, 3_600_000),
        ...(o.points === undefined ? {} : { points: int(o, 'points', 0, 100_000) }),
      };
    case 'calib':
      return { t: 'calib', shown: nullable(o, 'shown', (obj, k) => oneOf(obj, k, CALIBRATION_PATTERNS)) };
    case 'pong':
      return { t: 'pong', ts: num(o, 'ts', 0) };
    default:
      return fail(`unknown tv message type "${String(o.t)}"`);
  }
}

function decodeWith<T>(text: string, read: (o: Json) => T): DecodeResult<T> {
  try {
    return { ok: true, message: read(parseEnvelope(text)) };
  } catch (error) {
    if (error instanceof DecodeError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Used by the TV to read what the teacher phone sends. */
export const decodeTeacherMessage = (text: string): DecodeResult<TeacherMessage> => decodeWith(text, readTeacherMessage);

/** Used by the teacher phone to read what the TV sends. */
export const decodeTvMessage = (text: string): DecodeResult<TvMessage> => decodeWith(text, readTvMessage);
