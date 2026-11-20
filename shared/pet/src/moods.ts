/**
 * Mimikai's moods: what the class octopus feels, how long it shows it and what it does with its
 * rings. The design (faces, timings, why each mood exists) is docs/brand/motion/mimikai-moods.html;
 * this table is that page turned into data, so every rule about the pet can be unit-tested.
 *
 * Kid-facing words are Spanish, short, and never blame: wrong answers cost no points, and the
 * pet should not cost pride either.
 */

/** The eleven faces cut from the logo. "happy" is the logo itself. */
export type Face = 'happy' | 'open' | 'think' | 'grin' | 'star' | 'gentle' | 'wow' | 'sparkle' | 'love' | 'sleepy' | 'wink';

export type Mood =
  /** Lobby or pairing: breathes, blinks, juggles slowly, looks around for the class. */
  | 'waiting'
  /** No phone for a while: tells the teacher the TV is waiting, quietly. */
  | 'nap'
  /** A child held a hand on Mimikai in the lobby: the first thing children play with. */
  | 'tickled'
  /** A child just stepped in front of the camera: Mimikai waves at that half of the wall. */
  | 'wave'
  /** The class starts. */
  | 'hello'
  /** A question is on the wall: small and slow, the tiles are the star. */
  | 'think'
  /** Half the time gone and nobody has chosen: shows the only gesture by doing it. */
  | 'showMe'
  /** The last seconds of a question. Excited, never anxious. */
  | 'hurry'
  | 'gotIt'
  /** A streak of 3 or 7. */
  | 'onFire'
  | 'niceTry'
  /** Two teams, one right: one arm cheers that half, the other waves kindly to the other. */
  | 'oneArmEach'
  /** Two teams, both right. */
  | 'highFive'
  | 'levelUp'
  /** Five in a row: every ring goes up as a hoop for Rayitas, and Mimikai cheers it through them. */
  | 'bigJump'
  /** The summary: praises effort and the best streak, not only the winner. */
  | 'greatEffort';

/** What the toys do. Moods that need the arms (wave, point, high five) put the rings down first. */
export type RingPlan =
  | { readonly mode: 'juggle'; readonly beatMs: number; /** Throw height, rig units (default grows with the count). */ readonly height?: number }
  /** One ring thrown straight up from the left tentacle, the others resting. */
  | { readonly mode: 'toss'; readonly beatMs: number; readonly height: number }
  /** Every ring circles the pet. */
  | { readonly mode: 'orbit'; readonly periodMs: number }
  /** Rings lie flat beside the tentacles. */
  | { readonly mode: 'rest' }
  /** Rings are thrown up and away (they are Rayitas's hoops for now). */
  | { readonly mode: 'away' };

export interface MoodSpec {
  readonly face: Face;
  /** Things Mimikai says; empty = no words (the wall is busy enough). */
  readonly lines: readonly string[];
  /** Length of one play, ms. A looping mood repeats it until the moment changes. */
  readonly ms: number;
  readonly loop: boolean;
  readonly rings: RingPlan;
}

const REST: RingPlan = { mode: 'rest' };

export const MOODS: Readonly<Record<Mood, MoodSpec>> = {
  waiting: { face: 'open', lines: [], ms: 6_000, loop: true, rings: { mode: 'juggle', beatMs: 800 } },
  nap: { face: 'sleepy', lines: [], ms: 4_000, loop: true, rings: REST },
  tickled: {
    face: 'happy',
    lines: ['¡Jijiji! ¡Cosquillas!', '¡Otra vez!', '¡Me encanta jugar contigo!'],
    ms: 1_600,
    loop: false,
    // It curls up its arms to giggle, so the rings fly round it on their own.
    rings: { mode: 'orbit', periodMs: 1_600 },
  },
  wave: { face: 'happy', lines: ['¡Hola!', '¡Te veo!'], ms: 2_000, loop: false, rings: REST },
  hello: { face: 'happy', lines: ['¡Hola, clase!', '¿Jugamos?'], ms: 2_500, loop: false, rings: REST },
  think: { face: 'think', lines: [], ms: 4_000, loop: true, rings: { mode: 'toss', beatMs: 1_600, height: 46 } },
  showMe: { face: 'wow', lines: ['Pon tu mano sobre una respuesta'], ms: 3_000, loop: false, rings: REST },
  hurry: { face: 'grin', lines: ['¡Ya casi!'], ms: 720, loop: true, rings: { mode: 'juggle', beatMs: 360 } },
  gotIt: { face: 'happy', lines: ['¡Muy bien!', '¡Lo lograste!', '¡Pensaste rápido!'], ms: 1_800, loop: false, rings: { mode: 'juggle', beatMs: 500, height: 100 } },
  onFire: { face: 'star', lines: ['¡Imparables!'], ms: 2_000, loop: false, rings: { mode: 'orbit', periodMs: 1_600 } },
  niceTry: { face: 'gentle', lines: ['¡Casi! Veamos juntos', '¡Buen intento!', '¡Casi! La próxima es tuya'], ms: 2_400, loop: false, rings: REST },
  oneArmEach: { face: 'wink', lines: [], ms: 1_600, loop: false, rings: REST },
  highFive: { face: 'happy', lines: ['¡Los dos equipos!', '¡Todos lo lograron!'], ms: 1_400, loop: false, rings: REST },
  levelUp: { face: 'sparkle', lines: [], ms: 2_600, loop: false, rings: { mode: 'juggle', beatMs: 600 } },
  bigJump: { face: 'star', lines: [], ms: 5_800, loop: false, rings: { mode: 'away' } },
  greatEffort: { face: 'love', lines: ['¡Qué gran esfuerzo, clase!'], ms: 4_000, loop: true, rings: REST },
};

/** Moods of the 4-second answer screen: each must peak early and end while the answer is on screen. */
export const REACTIONS: readonly Mood[] = ['gotIt', 'onFire', 'niceTry', 'oneArmEach', 'highFive'];

/** A line for this mood, varied by a counter (round, tickles) so a class doesn't hear one phrase all day. */
export function lineOf(mood: Mood, turn: number): string | null {
  const { lines } = MOODS[mood];
  return lines.length === 0 ? null : lines[Math.abs(Math.trunc(turn)) % lines.length]!;
}
