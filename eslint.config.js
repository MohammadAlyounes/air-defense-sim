import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const SIM_PURITY_MESSAGE =
  'src/sim is the pure, deterministic simulation core (see CLAUDE.md): no UI, rendering, browser or wall-clock APIs.';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),

  // TypeScript everywhere.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023 },
  },

  // React app code.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  // Node-side files: configs, browser tests, media scripts.
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    extends: [js.configs.recommended],
  },

  // The simulation core must stay pure and deterministic.
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                'react/*',
                'three',
                'three/*',
                '@react-three/*',
                'zustand',
                'zustand/*',
                'lucide-react',
                '@radix-ui/*',
              ],
              message: SIM_PURITY_MESSAGE,
            },
            { group: ['**/app', '**/app/**'], message: SIM_PURITY_MESSAGE },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'indexedDB',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'setTimeout',
          'setInterval',
          'performance',
        ].map((name) => ({ name, message: SIM_PURITY_MESSAGE })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG from the sim core so every run is reproducible.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Sim time comes from the sim clock, never the wall clock.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Sim time comes from the sim clock, never the wall clock.',
        },
      ],
    },
  },
]);
