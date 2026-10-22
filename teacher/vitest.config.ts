import { defineConfig } from 'vitest/config';

// Unit tests cover the pure layers only (domain + application). They never import react-native.
export default defineConfig({
  test: {
    include: ['src/features/**/{domain,application}/**/*.test.ts'],
    environment: 'node',
  },
});
