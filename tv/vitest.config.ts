import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Shared packages declare jotai and the contracts as peers (one copy per app bundle),
// so unit tests borrow them from the Fire OS app, exactly like Metro does.
const appModules = path.resolve(__dirname, 'apps/expo-tv/node_modules');

export default defineConfig({
  resolve: {
    alias: [
      { find: /^jotai(\/.*)?$/, replacement: `${appModules}/jotai$1` },
      { find: '@projectplay/contracts', replacement: path.resolve(__dirname, '../shared/contracts/src/index.ts') },
    ],
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    environment: 'node',
  },
});
