export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly', setInterval: 'readonly' }
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  }
];
