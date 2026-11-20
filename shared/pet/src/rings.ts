/**
 * The rings are toys, not part of the body: the octopus juggles one ring per class level, so
 * children *see* the questions getting harder. Card levels stop at 3, so a team on a streak
 * adds its own ring on top, up to five.
 *
 * Level rings belong to the whole class (sun, lilac, white); only streak rings carry a team
 * colour, so the pet never juggles one team's colour while the class levels up.
 */
import type { Level, TeamId } from '@mimikai/contracts';

export type Ring = 'sun' | 'lilac' | 'white' | 'mint' | 'coral';

/** Every ring, in the order they join. */
export const ALL_RINGS: readonly Ring[] = ['sun', 'lilac', 'white', 'mint', 'coral'];
const LEVEL_RINGS: readonly Ring[] = ['sun', 'lilac', 'white'];
const TEAM_RING: Readonly<Record<TeamId, Ring>> = { A: 'mint', B: 'coral' };

/** A team's ring joins the juggle at this many right answers in a row. */
export const STREAK_RING_AT = 3;

export function ringsFor(level: Level, teams: readonly { readonly team: TeamId; readonly streak: number }[]): readonly Ring[] {
  const streaks = teams.filter((t) => t.streak >= STREAK_RING_AT).map((t) => TEAM_RING[t.team]);
  return [...LEVEL_RINGS.slice(0, level), ...streaks];
}

/** The first `count` rings (1–5), for a pet that collects rings outside a class. */
export const firstRings = (count: number): readonly Ring[] => ALL_RINGS.slice(0, Math.max(1, Math.min(ALL_RINGS.length, Math.trunc(count))));
