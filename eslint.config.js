const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  // Client-side code (browser globals)
  {
    files: ['src/client/**/*.{ts,tsx,js,jsx}', 'src/common/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        EventSource: 'readonly',
        MessageEvent: 'readonly',
        ReadableStreamDefaultReader: 'readonly',
        TextDecoder: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      // Base ESLint rules
      ...js.configs.recommended.rules,
      
      // TypeScript ESLint rules
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      
      // React rules
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/jsx-props-no-spreading': 'warn',
      
      // React Hooks rules
      ...reactHooks.configs.recommended.rules,
      
      // General rules
      'no-console': 'off', // Allow console for debugging
      'prefer-const': 'error',
      'no-var': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Server-side code (Node.js globals)
  {
    files: ['src/server/**/*.{ts,js}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        NodeJS: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        TextDecoder: 'readonly',
        URL: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        module: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // Base ESLint rules
      ...js.configs.recommended.rules,
      
      // TypeScript ESLint rules
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-require-imports': 'off', // Allow require in server code
      
      // General rules
      'no-console': 'off', // Allow console for debugging
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'dist-server/**', 
      'dist-client/**',
      'node_modules/**',
      '*.js', // Ignore root level JS files
      'vite.config.ts', // Ignore Vite config
    ],
  },
]; 