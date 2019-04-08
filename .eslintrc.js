'use strict';

// node core

// third-party

// internal

module.exports = {
  parserOptions: {
    sourceType: 'script',
    ecmaFeatures: {
      jsx: false,
    },
  },
  env: {
    jest: true,
    node: true,
  },
  plugins: ['prettier'],
  extends: ['airbnb-base', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.js'],
      parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module',
      },
      rules: {
        extends: 'plugin:ava/recommended',
        plugins: ['ava'],
        rules: {
          'import/no-extraneous-dependencies': [
            'error',
            { devDependencies: true },
          ],
        },
      },
    },
  ],
};
