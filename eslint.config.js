// Root ESLint flat config (ESLint 10). Replaces the legacy .eslintrc.cjs.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // Global ignores (flat config replacement for ignorePatterns / .eslintignore).
    ignores: [
      '**/dist/**',
      '**/build/**',
      'coverage/**',
      'playwright-report/**',
      'apps/server/generated/**',
      '**/*.config.js',
      '**/*.config.cjs',
      'docs/design/mockups/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
