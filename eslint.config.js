const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'test/**/*.{js,jsx}'],
    plugins: {
      react,
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        // Vitest globals (vitest.config.mjs sets `globals: true`).
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'prettier/prettier': 'error',
    },
  },
  {
    // CommonJS config files at the repo root (this file, etc.)
    files: ['*.js', '*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    // ESM tooling: build scripts and *.mjs configs.
    files: ['scripts/**/*.{js,mjs}', '*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  prettierConfig,
];
