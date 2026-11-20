/**
 * What the pet remembers between moments: things children did to it and how long the TV has
 * been waiting for the phone. Everything else it reads from the class as it is now.
 */
import type { TeamId } from '@mimikai/contracts';

export interface PetMemory {
  /** When the phone link was lost (null while linked). */
  readonly offlineSince: number | null;
  /** The last time a child held a hand on Mimikai, and how many times so far. */
  readonly tickle: { readonly team: TeamId; readonly at: number; readonly count: number } | null;
  /** The last child who stepped in front of the camera. */
  readonly arrival: { readonly team: TeamId; readonly at: number } | null;
}

export type PetEvent =
  | { readonly type: 'linked' }
  | { readonly type: 'unlinked'; readonly now: number }
  | { readonly type: 'tickled'; readonly team: TeamId; readonly now: number }
  | { readonly type: 'arrived'; readonly team: TeamId; readonly now: number };

export const INITIAL_PET_MEMORY: PetMemory = { offlineSince: null, tickle: null, arrival: null };

export function reducePet(memory: PetMemory, event: PetEvent): PetMemory {
  switch (event.type) {
    case 'linked':
      return memory.offlineSince === null ? memory : { ...memory, offlineSince: null };
    case 'unlinked':
      // The first loss counts: a link that keeps retrying is still the same wait.
      return memory.offlineSince !== null ? memory : { ...memory, offlineSince: event.now };
    case 'tickled':
      return { ...memory, tickle: { team: event.team, at: event.now, count: (memory.tickle?.count ?? 0) + 1 } };
    case 'arrived':
      return { ...memory, arrival: { team: event.team, at: event.now } };
  }
}
