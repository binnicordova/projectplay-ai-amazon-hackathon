import { defineConfig } from 'vitest/config';

// Unit tests cover the pure layers (domain + application) and adapters that take their I/O as
// parameters (e.g. the AI provider with an injected fetch). They never import react-native.
export default defineConfig({
  test: {
    include: ['src/features/**/{domain,application}/**/*.test.ts', 'src/features/authoring/infrastructure/**/*.test.ts'],
    environment: 'node',
  },
});
