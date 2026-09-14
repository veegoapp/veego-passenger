module.exports = {
  preset: 'jest-expo',
  // Ratchets test coverage on the modules that actually have unit tests
  // today (pure logic + the axios client/session helpers). Hooks, screens
  // and native-module wrappers need component/E2E tests, not unit
  // coverage, and are deliberately left out rather than counted against a
  // global number they'll never move. Add a module's path here as it gains
  // real tests; thresholds are set just below current coverage so CI fails
  // on a regression and can be raised over time.
  collectCoverageFrom: [
    'src/api/normalizeApiUrl.ts',
    'src/api/client.ts',
    'src/api/session.ts',
    'src/session/activeRideSelectors.ts',
    'src/session/activeSessionAdapter.ts',
    'src/utils/rideStateMerge.ts',
    'src/utils/errorMessages.ts',
    'src/utils/geoHelpers.ts',
    'constants/i18n/en.ts',
    'constants/i18n/ar.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 82,
      lines: 90,
    },
  },
};
