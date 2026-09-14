const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    // Node-executed config scripts, not app/bundle code.
    files: ['app.config.js', 'babel.config.js', 'metro.config.js', 'jest.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', __filename: 'readonly', module: 'readonly', require: 'readonly', process: 'readonly' },
    },
  },
  {
    rules: {
      // React Compiler readiness rules (added by eslint-config-expo): real
      // and worth fixing, but the existing codebase (pre-dating this lint
      // setup) has ~200 pre-existing violations across contexts and hooks —
      // too large to fix as part of adding CI linting. Downgraded to
      // warnings so `pnpm lint` is actionable in CI without blocking every
      // build; can be raised back to 'error' once the backlog is cleared.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      // app/_layout.tsx calls usePushToken() inside `if (!isExpoGo)`; isExpoGo
      // is a module-level constant fixed for the process lifetime, so the
      // hook order is in practice stable, but the rule can't know that
      // statically. Flagging as a warning rather than silencing it outright.
      'react-hooks/rules-of-hooks': 'warn',
      // eslint-plugin-import's resolver doesn't know about tsconfig's
      // "moduleSuffixes": [".native", ""] platform-extension resolution
      // (components/shared/*.native.tsx), so it can't find modules that
      // `tsc` resolves fine. Downgraded to avoid false-positive errors on
      // every platform-specific import; the TypeScript compiler is the
      // authority on whether these imports actually resolve.
      'import/no-unresolved': 'warn',
    },
  },
];
