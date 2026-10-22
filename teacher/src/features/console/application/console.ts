/**
 * Teacher console: choose what to play and drive the session on the TV.
 * The TV owns the game rules; the phone only sends commands.
 */
import {
  DEFAULT_TEAM_COUNT,
  type GameMode,
  type SessionConfig,
  type SessionSnapshot,
  type SkillId,
  type TeacherMessage,
  type TeamCount,
  type TvMessage,
} from '@projectplay/contracts';
import { atom } from 'jotai';

export const SKILL_LABELS: Readonly<Record<SkillId, string>> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  missingAddend: 'Missing number',
};

/** Children always answer by pointing at a tile and holding still; they can change it until time is up. */
export const MODE_LABELS: Readonly<Record<GameMode, { title: string; howTo: string }>> = {
  choice: { title: 'Pick the number', howTo: 'Point at the answer and hold still. They can change it until time runs out.' },
  trueFalse: { title: 'True or false', howTo: 'Point at TRUE or FALSE and hold still. They can change it until time runs out.' },
};

export const ROUND_OPTIONS = [3, 5, 8] as const;

/** Two teams first: it is the classroom default. */
export const TEAM_OPTIONS: readonly TeamCount[] = [2, 1];
/** Where the children stand changes with this choice, so the caption says it. */
export const TEAM_LABELS: Readonly<Record<TeamCount, { title: string; howTo: string }>> = {
  2: { title: 'Two teams', howTo: 'Team A stands on the left half of the wall, team B on the right. One child per team at a time.' },
  1: { title: 'One player', howTo: 'One child at a time uses the whole wall. Children can take turns.' },
};

export const selectedSkillAtom = atom<SkillId>('missingAddend');
export const selectedModeAtom = atom<GameMode>('choice');
export const selectedRoundsAtom = atom<number>(5);
export const selectedTeamsAtom = atom<TeamCount>(DEFAULT_TEAM_COUNT);

export const sessionConfigAtom = atom<Omit<SessionConfig, 'seed'>>((get) => ({
  skill: get(selectedSkillAtom),
  mode: get(selectedModeAtom),
  rounds: get(selectedRoundsAtom),
  teams: get(selectedTeamsAtom),
}));

/**
 * How many teams the camera should look for. A session on the TV (even a remote-control
 * practice the phone did not start) decides; between sessions the teacher's choice does, so the
 * preview already shows where children will stand. TVs from before one-player mode play two.
 */
export function teamCountFor(snapshot: SessionSnapshot | null, selected: TeamCount): TeamCount {
  if (snapshot === null || snapshot.phase === 'lobby') return selected;
  return snapshot.teams ?? DEFAULT_TEAM_COUNT;
}

/** One line per round result, e.g. "Q2: Team A · correct · 4.2 s". One player needs no team name. */
export function resultLabel(result: Extract<TvMessage, { t: 'result' }>, teams: TeamCount): string {
  const who = result.team === null ? 'time up' : teams === 1 ? null : `Team ${result.team}`;
  const parts = [who, result.correct ? 'correct' : 'try again', `${(result.ms / 1000).toFixed(1)} s`].filter((p) => p !== null);
  return `Q${result.round}: ${parts.join(' · ')}`;
}

/** A fresh seed per class; the TV derives every question from it, so a lesson can be replayed. */
export function startCommand(config: Omit<SessionConfig, 'seed'>, random: () => number = Math.random): TeacherMessage {
  return { t: 'ctl', a: 'start', config: { ...config, seed: Math.floor(random() * 2 ** 32) >>> 0 } };
}

export const nextCommand: TeacherMessage = { t: 'ctl', a: 'next' };
export const endCommand: TeacherMessage = { t: 'ctl', a: 'end' };
