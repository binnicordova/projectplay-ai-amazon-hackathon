import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * End-to-end wire test on loopback: the teacher's RFC 6455 server codec + LinkService
 * against the TV's LinkClient using Node's standards-compliant WebSocket (Node ≥ 22).
 * Needs `teacher/` installed (borrows its jotai). Run: npm run test:e2e
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^jotai(\/.*)?$/, replacement: `${path.resolve(__dirname, '../teacher/node_modules/jotai')}$1` },
      { find: '@projectplay/contracts', replacement: path.resolve(__dirname, 'contracts/src/index.ts') },
    ],
  },
  test: { include: ['e2e/**/*.e2e.test.ts'], environment: 'node', testTimeout: 15_000 },
});
