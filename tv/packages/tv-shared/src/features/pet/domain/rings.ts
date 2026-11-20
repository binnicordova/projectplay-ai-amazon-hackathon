/**
 * The rings in play during a class (the ring model itself is shared: @mimikai/pet).
 */
import type { Level } from '@mimikai/contracts';
import { SALTO, endingRings, ringsFor, type Ring } from '@mimikai/pet';
import type { ClassMoment } from './moment';

/**
 * The rings in play right now. Before a class there is one: the class starts at level 1.
 * Going down a level or breaking a streak sets a ring down at once, quietly.
 */
export function ringsAt(moment: ClassMoment, now: number): readonly Ring[] {
  switch (moment.kind) {
    case 'offline':
    case 'lobby':
      return ringsFor(1, []);
    case 'question':
      return ringsFor(moment.level, moment.teams);
    case 'summary':
      // The rings the class ends with: two for a spark, three for an energy ball, all five for a super ball.
      return endingRings(moment.ball.ending);
    case 'feedback': {
      // The new level's ring joins when Rayitas has jumped through it and it flies back.
      const { celebration } = moment;
      const waiting = moment.levelChange === 'up' && (celebration === null || now < celebration.at + SALTO.ringsBackMs);
      return ringsFor(waiting ? ((moment.level - 1) as Level) : moment.level, moment.teams);
    }
  }
}
