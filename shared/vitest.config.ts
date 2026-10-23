import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['contracts/src/**/*.test.ts', 'exercise-engine/src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
});
