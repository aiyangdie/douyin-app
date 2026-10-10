const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'expo-env.d.ts'],
  },
  {
    // `tools/shoot.mjs` is a standalone Node script (the CDP verification
    // harness), not part of the React Native bundle, so it needs Node globals
    // rather than the browser-oriented defaults from eslint-config-expo.
    files: ['tools/**/*.mjs', 'tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
]);
