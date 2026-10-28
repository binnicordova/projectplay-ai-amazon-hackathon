/** Which pictures travel with a lesson: only the ones it shows, plus the game's own icons. */
import { UI_ICONS, iconsOf, type IconArt, type IconId, type Lesson } from '@mimikai/contracts';

export function artForLesson(lesson: Lesson, library: IconArt): IconArt {
  const wanted = [...iconsOf(lesson), ...Object.values(UI_ICONS)];
  return Object.fromEntries(wanted.filter((id) => library[id] !== undefined).map((id) => [id, library[id]!]));
}

/** Icons a lesson uses that this app has no art for (shown as emoji instead). */
export const missingIcons = (lesson: Lesson, library: IconArt): readonly IconId[] => iconsOf(lesson).filter((id) => library[id] === undefined);
