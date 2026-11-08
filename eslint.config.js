// @ts-check
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'release/**'] },
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['contract/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './contract/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        globalThis: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        console: 'readonly',
        URLSearchParams: 'readonly',
        HTMLElement: 'readonly',
        __MODULE_VERSION__: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Base no-redeclare doesn't understand TS function overload signatures
      // (e.g. deep-links.ts's atlasDocumentUrl) — use the TS-aware version instead.
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },
];
