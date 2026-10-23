// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * Layer rules (DDD-style bounded contexts under src/features/<context>/):
 *   domain          pure TypeScript, no React / React Native / Expo / Jotai, no other layers
 *   application     use cases + Jotai atoms + ports; no native modules, no UI, no adapters
 *   infrastructure  adapters to native libraries; never imports UI
 *   ui              components; never imports adapters (the composition root and routes wire them)
 */
const nativeAndUi = ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*'];
const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message: 'Layer boundary: see eslint.config.js.' }] }],
});

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*'] },
  {
    files: ['src/features/*/domain/**/*.ts'],
    rules: restrict([...nativeAndUi, 'jotai', 'jotai/*', '**/application/*', '**/infrastructure/*', '**/ui/*', '**/composition/*']),
  },
  {
    files: ['src/features/*/application/**/*.ts'],
    rules: restrict([...nativeAndUi, '**/infrastructure/*', '**/ui/*', '**/composition/*']),
  },
  {
    files: ['src/features/*/infrastructure/**/*.{ts,tsx}'],
    rules: restrict(['**/ui/*', '**/composition/*', '**/app/*']),
  },
  {
    files: ['src/features/*/ui/**/*.{ts,tsx}'],
    rules: restrict(['**/infrastructure/*', '**/composition/*']),
  },
  {
    // Lessons, AI chat and pictures are written functionally: data in, data out, errors as values.
    files: ['src/features/{authoring,library,pictures,console}/{domain,application}/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ClassDeclaration', message: 'Functional core: use functions and plain data, not classes.' },
        { selector: 'ThrowStatement', message: 'Functional core: return a Result instead of throwing.' },
      ],
    },
  },
]);
