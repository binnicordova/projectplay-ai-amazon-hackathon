/**
 * What Mimikai does right now: one pure function of the class, the pet's memory and the time,
 * so every rule in the "when the TV plays each one" table of the moods page has a test.
 */
import type { TeamId } from '@mimikai/contracts';
import { MOODS, energyBeats, granTiming, lineOf, mimiMoodAt, ringsFor, type Mood, type PetCue } from '@mimikai/pet';
import type { PetMemory } from './memory';
import type { Celebration, ClassMoment, TeamResult } from './moment';

/** With no phone this long, the pet naps: the TV is waiting, without being bright in a quiet room. */
export const NAP_AFTER_MS = 120_000;
/** The lobby's invitation: holding a hand on Mimikai is the same gesture that answers a question. */
export const INVITE = 'Pon tu mano sobre mí';

const cue = (mood: Mood, key: string, line: string | null = null, side: TeamId | null = null, count: number | null = null): PetCue => ({
  mood,
  key,
  side,
  line,
  count,
});

/** Something that happened at `at` is still playing at `now`. */
const playing = (mood: Mood, at: number, now: number): boolean => now >= at && now - at < MOODS[mood].ms;

export function cueOf(moment: ClassMoment, memory: PetMemory, now: number): PetCue {
  switch (moment.kind) {
    case 'offline':
      return memory.offlineSince !== null && now - memory.offlineSince >= NAP_AFTER_MS ? cue('nap', 'nap') : cue('waiting', 'offline');

    case 'lobby': {
      const { tickle, arrival } = memory;
      // The latest thing a child did wins.
      if (tickle && playing('tickled', tickle.at, now) && (!arrival || tickle.at >= arrival.at)) {
        return cue('tickled', `tickle:${tickle.count}`, lineOf('tickled', tickle.count - 1), tickle.team);
      }
      if (arrival && playing('wave', arrival.at, now)) return cue('wave', `wave:${arrival.at}`, lineOf('wave', arrival.at), arrival.team);
      return cue('waiting', 'lobby', INVITE);
    }

    case 'question': {
      const { round, startedAt, endsAt, hurryAt, chosen } = moment;
      const key = (mood: Mood) => `q${round}:${mood}`;
      // Before the first card opens, Mimikai greets the class (full screen).
      if (now < startedAt) return cue('hello', key('hello'), lineOf('hello', 0));
      if (now >= hurryAt) return cue('hurry', key('hurry'), lineOf('hurry', round));
      const half = startedAt + (endsAt - startedAt) / 2;
      if (!chosen && playing('showMe', half, now)) return cue('showMe', key('showMe'), lineOf('showMe', round));
      return cue('think', key('think'));
    }

    case 'feedback': {
      const { round, teams, celebration } = moment;
      // The round's own reaction first, in the answer panel; then the party, full screen.
      if (celebration && now >= celebration.at) return party(celebration, round, teams.length, ringsFor(moment.level, teams).length, now);
      return reactionTo(teams, round);
    }

    case 'summary': {
      // The energy ball first (it shows its own words), then praise for the whole class's effort.
      const beats = energyBeats(moment.ball.ending, moment.ball.rightAnswers);
      const elapsed = now - moment.ball.at;
      const praise = moment.bestStreak >= 3 ? `¡Qué gran esfuerzo! Racha de ${moment.bestStreak}` : lineOf('greatEffort', 0);
      if (elapsed >= beats.ms) return cue('greatEffort', 'summary:greatEffort', praise);
      const mood = elapsed < 0 ? 'hurry' : mimiMoodAt(beats, elapsed);
      return cue(mood, `summary:${mood}`);
    }
  }
}

function party(celebration: Celebration, round: number, teamCount: number, rings: number, now: number): PetCue {
  if (celebration.kind === 'levelUp') return cue('levelUp', `f${round}:levelUp`, `¡Subimos al nivel ${celebration.level}!`);
  // One team on fire in a two-team class: Mimikai turns to that half of the wall.
  const side = teamCount > 1 && celebration.teams.length === 1 ? celebration.teams[0]! : null;
  const line = `¡${celebration.streak} seguidas!`;
  // A first five in a row: every ring goes up as a hoop for Rayitas, then Mimikai cheers.
  if (celebration.big && now - celebration.at < granTiming(rings).ringsBackMs) return cue('bigJump', `f${round}:bigJump`, line, null, celebration.streak);
  return cue('onFire', `f${round}:onFire`, line, side, celebration.streak);
}

/** The answer screen's reaction. Never sad, never a cross: a wrong answer gets a warm nod. */
function reactionTo(teams: readonly TeamResult[], round: number): PetCue {
  const key = (mood: Mood) => `f${round}:${mood}`;
  const right = teams.filter((t) => t.correct);
  if (teams.length === 1) {
    const solo = right[0];
    if (!solo) return cue('niceTry', key('niceTry'), lineOf('niceTry', round));
    return cue('gotIt', key('gotIt'), lineOf('gotIt', round), solo.team);
  }
  // Two teams: getting it right together is celebrated louder than winning.
  if (right.length === teams.length) return cue('highFive', key('highFive'), lineOf('highFive', round));
  const winner = right[0];
  if (winner) return cue('oneArmEach', key('oneArmEach'), `¡Bien, equipo ${winner.team}!`, winner.team);
  return cue('niceTry', key('niceTry'), lineOf('niceTry', round));
}
