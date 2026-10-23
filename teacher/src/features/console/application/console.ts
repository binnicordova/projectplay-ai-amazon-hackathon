/**
 * Teacher console: choose who plays and how many cards, start the selected lesson on the TV,
 * and drive the class. The TV owns the game rules; the phone sends the lesson and commands.
 */
import { DEFAULT_TEAM_COUNT, type IconArt, type Lesson, type SessionSnapshot, type TeacherMessage, type TeamCount, type TvMessage } from '@projectplay/contracts';
import { atom } from 'jotai';
import { roundsFor } from '../../library/domain/catalog';
import { artForLesson } from '../../pictures/domain/art';

export const ROUND_OPTIONS = [5, 10, 15] as const;

/** Two teams first: it is the classroom default. */
export const TEAM_OPTIONS: readonly TeamCount[] = [2, 1];
/** Where the children stand changes with this choice, so the caption says it. */
export const TEAM_LABELS: Readonly<Record<TeamCount, { title: string; howTo: string }>> = {
  2: { title: 'Dos equipos', howTo: 'El equipo A a la izquierda de la pared, el B a la derecha. Un niño por equipo a la vez.' },
  1: { title: 'Un jugador', howTo: 'Un niño usa toda la pared. Pueden turnarse para batir el récord.' },
};

export const selectedRoundsAtom = atom<number>(10);
export const selectedTeamsAtom = atom<TeamCount>(DEFAULT_TEAM_COUNT);

/**
 * How many teams the camera should look for. A session on the TV decides; between sessions the
 * teacher's choice does, so the preview already shows where children will stand.
 */
export function teamCountFor(snapshot: SessionSnapshot | null, selected: TeamCount): TeamCount {
  if (snapshot === null || snapshot.phase === 'lobby') return selected;
  return snapshot.teams ?? DEFAULT_TEAM_COUNT;
}

/** One line per round result, e.g. "P2: Equipo A · bien · +175 · 4,2 s". One player needs no team name. */
export function resultLabel(result: Extract<TvMessage, { t: 'result' }>, teams: TeamCount): string {
  const who = result.team === null ? 'se acabó el tiempo' : teams === 1 ? null : `Equipo ${result.team}`;
  const points = result.correct && result.points ? `+${result.points}` : null;
  const parts = [who, result.correct ? 'bien' : 'a intentarlo otra vez', points, `${(result.ms / 1000).toFixed(1).replace('.', ',')} s`].filter((p) => p !== null);
  return `P${result.round}: ${parts.join(' · ')}`;
}

export interface PlayRequest {
  readonly lesson: Lesson;
  /** Every picture the phone has; only the lesson's go to the TV. */
  readonly library: IconArt;
  readonly rounds: number;
  readonly teams: TeamCount;
  readonly record?: number;
}

/** The start command: the whole lesson and its pictures travel with it, and a fresh seed per class. */
export function startCommand({ lesson, library, rounds, teams, record }: PlayRequest, random: () => number = Math.random): TeacherMessage {
  return {
    t: 'ctl',
    a: 'start',
    config: {
      lesson,
      art: artForLesson(lesson, library),
      rounds: roundsFor(lesson, rounds),
      seed: Math.floor(random() * 2 ** 32) >>> 0,
      teams,
      ...(record === undefined ? {} : { record }),
    },
  };
}

export const nextCommand: TeacherMessage = { t: 'ctl', a: 'next' };
export const endCommand: TeacherMessage = { t: 'ctl', a: 'end' };
