/**
 * ProgressStore adapter: Mimi's journey in one JSON file in the app's document folder. It never
 * leaves the phone (no accounts, no analytics).
 */
import { err, ok } from '@mimikai/contracts';
import { File, Paths } from 'expo-file-system';
import type { ProgressStore } from '../application/mimi';

const progressFile = () => new File(Paths.document, 'mimi.json');

export const fileProgressStore: ProgressStore = {
  load: async () => {
    try {
      const file = progressFile();
      return file.exists ? (JSON.parse(await file.text()) as unknown) : null;
    } catch {
      return null;
    }
  },
  save: async (progress) => {
    try {
      const file = progressFile();
      if (!file.exists) file.create();
      file.write(JSON.stringify(progress));
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
