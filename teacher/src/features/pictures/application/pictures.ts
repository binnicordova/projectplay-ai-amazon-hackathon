import type { IconArt } from '@projectplay/contracts';
import { atom } from 'jotai';

/** Every picture this app can show, by icon id. The composition root fills it with the bundled Twemoji art. */
export const iconArtAtom = atom<IconArt>({});
