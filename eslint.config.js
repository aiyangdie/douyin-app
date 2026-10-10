const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'node_modules/*',
      // ESLint only auto-ignores the literal `node_modules` directory, so a
      // partial backup such as `node_modules.before-repair-*` gets linted and
      // fails the whole run on third-party code.
      'node_modules.*/*',
      'expo-env.d.ts',
    ],
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
  {
    // `server/**` is a plain Node ESM service — no bundler, no React Native —
    // so it needs Node globals too. Without this every `Buffer` shows up as a
    // no-undef error even though the code is correct.
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
]);
