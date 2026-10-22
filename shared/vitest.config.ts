import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['contracts/src/**/*.test.ts'], environment: 'node' },
});
