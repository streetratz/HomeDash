import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';

const tsconfigRootDir = import.meta.dirname;

/** Shared custom rules for all TypeScript source files */
const sharedTsRules = {
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  '@typescript-eslint/no-floating-promises': 'error',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
};

/** Relaxed rules for test files */
const testRuleOverrides = {
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
};

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'node_modules/',
      '**/node_modules/',
      'dist/',
      '**/dist/',
      'build/',
      'coverage/',
      '*.min.js',
    ],
  },

  // Backend source files
  {
    files: ['backend/src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: {
        project: './backend/tsconfig.json',
        tsconfigRootDir,
      },
    },
    rules: sharedTsRules,
  },

  // Backend test files + config files
  {
    files: [
      'backend/tests/**/*.ts',
      'backend/drizzle.config.ts',
      'backend/vitest.config.ts',
    ],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: {
        project: './backend/tsconfig.test.json',
        tsconfigRootDir,
      },
    },
    rules: {
      ...sharedTsRules,
      ...testRuleOverrides,
    },
  },

  // Frontend source files
  {
    files: [
      'frontend/src/**/*.{ts,tsx}',
      'frontend/vite.config.ts',
      'frontend/vitest.config.ts',
      'frontend/tailwind.config.ts',
      'frontend/playwright.config.ts',
    ],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: {
        project: './frontend/tsconfig.json',
        tsconfigRootDir,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...sharedTsRules,
      ...reactHooks.configs.flat.recommended.rules,
      'react/prop-types': 'off',
    },
  },

  // Frontend E2E test files
  {
    files: ['frontend/tests/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: {
        project: './frontend/tsconfig.json',
        tsconfigRootDir,
      },
    },
    rules: {
      ...sharedTsRules,
      ...testRuleOverrides,
    },
  },

  // Config files (JS/CJS/MJS) — no type checking
  {
    files: ['*.cjs', '*.mjs', '*.js'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Prettier must be last to override formatting rules
  eslintConfigPrettier,
);
