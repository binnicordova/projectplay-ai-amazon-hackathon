/**
 * Where Mimikai stands on the wall, in projection space (0..1), and what the wall says with it.
 *
 * Like Duo, the pet owns the big moments: it greets the class full screen, throws the party for
 * a level up or a streak full screen, reacts to each answer from the answer panel, and otherwise
 * waits small in its corner so the tiles stay the star. In the lobby the same rectangle is drawn
 * and hit-tested, so what children see is what they can touch.
 */
import { ALL_RINGS, RIG_BOX, TIP, ringsFor, type PetCue, type Ring, type SceneId, type SceneStage } from '@mimikai/pet';
import type { NormalizedRect } from '../../interaction/domain/dwell';
import type { PetTarget } from '../../interaction/domain/layout';
import type { ClassMoment } from './moment';

/** Centre stage in the lobby, on the wall's centre line, so a child from either half reaches it. */
export const LOBBY_PET: NormalizedRect = { x: 0.3, y: 0.17, width: 0.4, height: 0.56 };

export const PET_TARGET: PetTarget = { kind: 'pet', id: 'pet', rect: LOBBY_PET, team: null };

export type Place = 'corner' | 'panel' | 'full';

/** Rayitas's part in a party: which scene, from when, through which rings. Never during a question. */
export interface RayitasCall {
  readonly scene: Exclude<SceneId, 'jugar'>;
  readonly at: number;
  readonly rings: readonly Ring[];
}

export interface Spotlight {
  readonly place: Place;
  /** Full screen only: the big line under the pet, and a smaller one under that. */
  readonly title: string | null;
  readonly detail: string | null;
  readonly rayitas: RayitasCall | null;
}

const CORNER: Spotlight = { place: 'corner', title: null, detail: null, rayitas: null };
const PANEL: Spotlight = { place: 'panel', title: null, detail: null, rayitas: null };

const ringsIn = (count: number) => (count === 1 ? '1 anillo' : `${count} anillos`);

/** Where the pet is during a class, and the words of a full-screen moment. */
export function spotlightOf(moment: ClassMoment, cue: PetCue): Spotlight {
  switch (cue.mood) {
    case 'hello':
      return { place: 'full', title: cue.line, detail: moment.kind === 'question' ? `Hoy jugamos: ${moment.title}` : null, rayitas: null };
    case 'levelUp': {
      if (moment.kind !== 'feedback') return { place: 'full', title: cue.line, detail: null, rayitas: null };
      // The new level's ring is the hoop Rayitas jumps through.
      const rayitas = moment.celebration ? { scene: 'salto' as const, at: moment.celebration.at, rings: [ALL_RINGS[moment.level - 1]!] } : null;
      return { place: 'full', title: cue.line, detail: `Mimikai ya hace malabares con ${ringsIn(moment.level)}`, rayitas };
    }
    case 'bigJump':
    case 'onFire': {
      const party = moment.kind === 'feedback' ? moment.celebration : null;
      const teams = party?.kind === 'streak' && moment.kind === 'feedback' && moment.teams.length > 1 ? party.teams : [];
      const detail = teams.length === 1 ? `¡El equipo ${teams[0]} está imparable!` : teams.length > 1 ? '¡Los dos equipos están imparables!' : '¡Imparables!';
      // Rayitas's big jump runs through the whole party, also once the rings are back.
      const rayitas = party?.kind === 'streak' && party.big && moment.kind === 'feedback' ? { scene: 'gran' as const, at: party.at, rings: ringsFor(moment.level, moment.teams) } : null;
      return { place: 'full', title: cue.line, detail, rayitas };
    }
    case 'gotIt':
    case 'niceTry':
    case 'oneArmEach':
    case 'highFive':
      return PANEL;
    default:
      return CORNER;
  }
}

/** Where a Mimikai is drawn, in pixels: the left and top of its rig box, and the box's height. */
export interface PetBox {
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

/** Rayitas's size next to Mimikai: about 55% of the octopus's height (the design's rule). */
const TIGER_PER_RIG = 1.25;

/** Rayitas's stage around a Mimikai drawn in `box`: the same floor, its rings and its left side. */
export function sceneStageAround(box: PetBox, wallLeft = 0): SceneStage {
  const u = box.size / RIG_BOX.height;
  const at = (x: number, y: number) => ({ x: box.left + (x - RIG_BOX.x) * u, y: box.top + (y - RIG_BOX.y) * u });
  return {
    ground: at(0, 250).y,
    unit: TIGER_PER_RIG * u,
    left: wallLeft,
    mimiLeft: at(25, 0).x,
    mimiTop: at(128, -40),
    mimiHand: at(TIP.R.x, TIP.R.y - 20),
    ringRadius: 17 * u,
  };
}

const sameCall = (a: RayitasCall | null, b: RayitasCall | null): boolean =>
  a === b || (a !== null && b !== null && a.scene === b.scene && a.at === b.at && a.rings.join() === b.rings.join());

export const sameSpotlight = (a: Spotlight, b: Spotlight): boolean =>
  a.place === b.place && a.title === b.title && a.detail === b.detail && sameCall(a.rayitas, b.rayitas);
