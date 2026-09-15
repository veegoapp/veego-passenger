module.exports = {
  preset: 'jest-expo',
  // AsyncStorage's native module isn't available under Jest — use the
  // package's own official mock instead of the native binding.
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
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
    'src/hooks/shared/usePaginatedList.ts',
    'src/hooks/shared/useRecentSearches.ts',
    'src/hooks/shared/useWallet.ts',
    'src/hooks/shared/usePromos.ts',
    'src/hooks/shared/useNotifications.ts',
    'src/hooks/shared/usePushToken.ts',
    'src/hooks/shared/useTrips.ts',
    'context/ActiveSessionContext.tsx',
    'context/BookingContext.tsx',
    'context/ServiceControlContext.tsx',
    'context/PaymentConfigContext.tsx',
  ],
  coverageThreshold: {
    global: {
      statements: 84,
      branches: 63,
      functions: 76,
      lines: 87,
    },
  },
};
