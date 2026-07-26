import type { NormalizedPassengerActiveSession } from './activeSessionTypes';

export type ActiveSessionRecoveryParams = {
  resumeService?: 'car' | 'scooter' | 'delivery' | 'shuttle';
};

export type ActiveSessionRecoveryDestination = {
  pathname: '/(tabs)';
  params?: ActiveSessionRecoveryParams;
};

/**
 * Maps the normalized session to the existing Home route.
 *
 * The service screens are intentionally not migrated in this phase. The
 * identifiers are carried as recovery params for the later screen-hydration
 * phases, while ActiveSession remains the source of truth.
 */
export function getActiveSessionRecoveryDestination(
  session: NormalizedPassengerActiveSession | null,
): ActiveSessionRecoveryDestination {
  if (!session) {
    return { pathname: '/(tabs)' };
  }

  if (session.kind === 'ride') {
    return {
      pathname: '/(tabs)',
      params: { resumeService: session.serviceType },
    };
  }

  return {
    pathname: '/(tabs)',
    params: { resumeService: 'shuttle' },
  };
}